import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse, type AuthenticationResponseJSON, type RegistrationResponseJSON } from "@simplewebauthn/server";
import { and, desc, eq, gt, ne } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { browserName, type Device, type Passkey } from "../shared/security.ts";
import { startSession, type AuthMethod } from "./access.ts";
import type { AppDependencies } from "./app.ts";
import { auditTrail } from "./audit.ts";
import { clientIp, limitKeys, loginLimit, tooManyTries } from "./login-limit.ts";
import { checkPassword } from "./passwords.ts";
import { kitchenMember, type MemberEnv } from "./recipes.ts";
import { passkeys, sessions, users } from "./schema.ts";
import { requireRecentAuth } from "./step-up.ts";

type Purpose = "login" | "register" | "step-up";
const challengeLifetime = 5 * 60 * 1000;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The page's address as the browser sends it: the public address, or any localhost port while developing. */
export function isAllowedOrigin(origin: string, publicUrl: URL) {
  if (origin === publicUrl.origin) return true;
  const url = URL.parse(origin);
  return publicUrl.hostname === "localhost" && url?.hostname === "localhost" && url.protocol === publicUrl.protocol;
}

/** Passkeys (log in, add, remove), "Confirm it's you", Devices and Activity. */
export function createSecurityRoutes({ database, now, publicUrl }: AppDependencies) {
  const { db } = database;
  const routes = new Hono<MemberEnv>();
  const member = kitchenMember({ database, now });
  const limit = loginLimit(database, now);
  const { audit, recent } = auditTrail(database, now);
  const rpID = publicUrl.hostname;
  const expectedOrigin = (c: Context) => {
    const origin = c.req.header("origin");
    return origin && isAllowedOrigin(origin, publicUrl) ? origin : publicUrl.origin;
  };

  // One server, so challenges wait in memory; a restart only means trying again. Each one works once.
  const challenges = new Map<string, { purpose: Purpose; userId?: string; expires: number }>();
  const remember = (challenge: string, purpose: Purpose, userId?: string) => {
    for (const [key, value] of challenges) if (value.expires < now().getTime()) challenges.delete(key);
    challenges.set(challenge, { purpose, userId, expires: now().getTime() + challengeLifetime });
  };
  const take = (purpose: Purpose, userId?: string) => (challenge: string) => {
    const found = challenges.get(challenge);
    challenges.delete(challenge);
    return !!found && found.purpose === purpose && found.userId === userId && found.expires >= now().getTime();
  };

  const toCredential = (row: typeof passkeys.$inferSelect) => ({ id: row.id, publicKey: Buffer.from(row.publicKey, "base64url"), counter: row.counter, transports: row.transports });

  /** Checks a passkey answer; returns the passkey row when it is good. */
  async function checkPasskey(c: Context, response: AuthenticationResponseJSON, purpose: Purpose, userId?: string) {
    const [row] = typeof response?.id === "string" ? await db.select().from(passkeys).where(eq(passkeys.id, response.id)) : [];
    if (!row || (userId && row.userId !== userId)) return undefined;
    const result = await verifyAuthenticationResponse({
      response,
      expectedChallenge: take(purpose, userId),
      expectedOrigin: expectedOrigin(c),
      expectedRPID: rpID,
      credential: toCredential(row),
      requireUserVerification: false,
    }).catch(() => undefined);
    if (!result?.verified) return undefined;
    await db.update(passkeys).set({ counter: result.authenticationInfo.newCounter, lastUsedAt: now() }).where(eq(passkeys.id, row.id));
    return row;
  }

  // Logging in with a passkey: no name to type; the phone offers the passkeys it has for this site.
  routes.post("/api/passkeys/login/options", async (c) => {
    if (await limit.blocked(limitKeys(clientIp(c)))) return c.json({ error: tooManyTries }, 429);
    const options = await generateAuthenticationOptions({ rpID, userVerification: "preferred" });
    remember(options.challenge, "login");
    return c.json(options);
  });

  routes.post("/api/passkeys/login", async (c) => {
    const response = (await c.req.json().catch(() => undefined)) as AuthenticationResponseJSON | undefined;
    const [owner] = typeof response?.id === "string" ? await db.select({ username: users.username }).from(passkeys).innerJoin(users, eq(users.id, passkeys.userId)).where(eq(passkeys.id, response.id)) : [];
    const keys = limitKeys(clientIp(c), owner?.username);
    if (await limit.blocked(keys)) return c.json({ error: tooManyTries }, 429);
    const passkey = response && (await checkPasskey(c, response, "login"));
    if (!passkey) {
      await limit.fail(keys);
      return c.json({ error: "That passkey didn't work. Log in with your password." }, 401);
    }
    await limit.clear(keys);
    await startSession({ database, now, publicUrl }, c, passkey.userId, "passkey");
    await audit(passkey.userId, "Logged in with passkey", passkey.name);
    return c.body(null, 204);
  });

  routes.get("/api/passkeys", member, async (c) => {
    const rows = await db.select().from(passkeys).where(eq(passkeys.userId, c.get("member").userId)).orderBy(passkeys.createdAt);
    return c.json(rows.map((row): Passkey => ({ id: row.id, name: row.name, createdAt: row.createdAt.toISOString(), lastUsedAt: row.lastUsedAt?.toISOString() ?? null })));
  });

  routes.post("/api/passkeys/register/options", member, async (c) => {
    const stepUp = requireRecentAuth(c);
    if (stepUp) return stepUp;
    const { userId } = c.get("member");
    const [[user], existing] = await Promise.all([
      db.select({ username: users.username }).from(users).where(eq(users.id, userId)),
      db.select({ id: passkeys.id, transports: passkeys.transports }).from(passkeys).where(eq(passkeys.userId, userId)),
    ]);
    const options = await generateRegistrationOptions({
      rpName: "Food planner",
      rpID,
      userName: user!.username,
      userID: new TextEncoder().encode(userId),
      attestationType: "none",
      excludeCredentials: existing,
      authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
    });
    remember(options.challenge, "register", userId);
    return c.json(options);
  });

  routes.post("/api/passkeys/register", member, async (c) => {
    const stepUp = requireRecentAuth(c);
    if (stepUp) return stepUp;
    const { userId } = c.get("member");
    const response = (await c.req.json().catch(() => undefined)) as RegistrationResponseJSON | undefined;
    const result =
      response &&
      (await verifyRegistrationResponse({ response, expectedChallenge: take("register", userId), expectedOrigin: expectedOrigin(c), expectedRPID: rpID, requireUserVerification: false }).catch(() => undefined));
    if (!result?.verified) return c.json({ error: "The passkey wasn't added. Try again." }, 400);
    const { credential } = result.registrationInfo;
    const name = browserName(c.req.header("user-agent") ?? "");
    await db
      .insert(passkeys)
      .values({ id: credential.id, userId, publicKey: Buffer.from(credential.publicKey).toString("base64url"), counter: credential.counter, transports: credential.transports ?? [], name, createdAt: now() })
      .onConflictDoNothing();
    await audit(userId, "Passkey added", name);
    return c.body(null, 204);
  });

  routes.delete("/api/passkeys/:id", member, async (c) => {
    const stepUp = requireRecentAuth(c);
    if (stepUp) return stepUp;
    const { userId } = c.get("member");
    const [removed] = await db.delete(passkeys).where(and(eq(passkeys.id, c.req.param("id")), eq(passkeys.userId, userId))).returning();
    if (!removed) return c.json({ error: "That passkey is already gone." }, 404);
    await audit(userId, "Passkey removed", removed.name);
    return c.body(null, 204);
  });

  // "Confirm it's you": with a passkey when you have one, else with your password.
  routes.post("/api/step-up/options", member, async (c) => {
    const { userId, session } = c.get("member");
    if (!session.hasPasskey) return c.json({ method: "password" });
    const mine = await db.select({ id: passkeys.id, transports: passkeys.transports }).from(passkeys).where(eq(passkeys.userId, userId));
    const options = await generateAuthenticationOptions({ rpID, allowCredentials: mine, userVerification: "preferred" });
    remember(options.challenge, "step-up", userId);
    return c.json({ method: "passkey", options });
  });

  routes.post("/api/step-up", member, async (c) => {
    const { userId, session } = c.get("member");
    const body = ((await c.req.json().catch(() => ({}))) ?? {}) as { password?: unknown; response?: AuthenticationResponseJSON };
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    const keys = limitKeys(clientIp(c), user!.username);
    if (await limit.blocked(keys)) return c.json({ error: tooManyTries }, 429);
    let method: AuthMethod | undefined;
    if (session.hasPasskey) {
      if (body.response && (await checkPasskey(c, body.response, "step-up", userId))) method = "passkey";
    } else if (typeof body.password === "string" && (await checkPassword(body.password, user!.passwordHash))) {
      method = "password";
    }
    if (!method) {
      await limit.fail(keys);
      return c.json({ error: session.hasPasskey ? "That passkey didn't work. Try again." : "Wrong password." }, 401);
    }
    await limit.clear(keys);
    await db.update(sessions).set({ authenticatedAt: now(), authMethod: method }).where(eq(sessions.id, session.id));
    return c.body(null, 204);
  });

  routes.get("/api/devices", member, async (c) => {
    const { userId, session } = c.get("member");
    const rows = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, now())))
      .orderBy(desc(sessions.lastUsedAt));
    return c.json(
      rows.map((row): Device => ({ id: row.id, browser: browserName(row.userAgent), createdAt: row.createdAt.toISOString(), lastUsedAt: row.lastUsedAt.toISOString(), current: row.id === session.id })),
    );
  });

  routes.delete("/api/devices/:id", member, async (c) => {
    const { userId } = c.get("member");
    const id = c.req.param("id");
    if (!uuidPattern.test(id)) return c.json({ error: "That device is already logged out." }, 404);
    const [removed] = await db.delete(sessions).where(and(eq(sessions.id, id), eq(sessions.userId, userId))).returning();
    if (!removed) return c.json({ error: "That device is already logged out." }, 404);
    await audit(userId, "Device logged out", browserName(removed.userAgent));
    return c.body(null, 204);
  });

  routes.post("/api/devices/log-out-others", member, async (c) => {
    const { userId, session } = c.get("member");
    const removed = await db.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.id, session.id))).returning({ id: sessions.id });
    await audit(userId, "Logged out everywhere else", removed.length === 1 ? "1 device" : `${removed.length} devices`);
    return c.json({ loggedOut: removed.length });
  });

  routes.get("/api/activity", member, async (c) => c.json(await recent(c.get("member").userId)));

  return routes;
}
