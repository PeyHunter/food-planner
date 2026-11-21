import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt, lte, or, sql } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AppDependencies } from "./app.ts";
import { auditTrail } from "./audit.ts";
import type { Database } from "./db.ts";
import { clientIp, limitKeys, loginLimit, tooManyTries } from "./login-limit.ts";
import { checkPassword } from "./passwords.ts";
import { kitchenMembers, kitchens, passkeys, sessions, users } from "./schema.ts";

const minute = 60 * 1000;
const hour = 60 * minute;
const day = 24 * hour;
// Browsers cap a cookie's Max-Age at 400 days.
const sessionLifetime = 400 * day;
export const sessionCookie = "fp_session";

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export type AuthMethod = "password" | "passkey";
/** The logged-in device, as the routes after the session check see it. */
export type Session = { id: string; authenticatedAt: Date; authMethod: AuthMethod; hasPasskey: boolean };

export function createAccessRoutes(dependencies: AppDependencies) {
  const { database, now, publicUrl } = dependencies;
  const { db } = database;
  const limit = loginLimit(database, now);
  const { audit } = auditTrail(database, now);
  const routes = new Hono();

  routes.post("/api/login", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { username?: unknown; password?: unknown };
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const keys = limitKeys(clientIp(c), username);
    if (await limit.blocked(keys)) return c.json({ error: tooManyTries }, 429);
    const [user] = username ? await db.select().from(users).where(eq(users.username, username)) : [];
    if (!user || !(await checkPassword(password, user.passwordHash))) {
      await limit.fail(keys);
      return c.json({ error: "Wrong name or password." }, 401);
    }
    await limit.clear(keys);
    await startSession({ database, now, publicUrl }, c, user.id, "password");
    await audit(user.id, "Logged in with password");
    return c.body(null, 204);
  });

  routes.get("/api/me", async (c) => {
    const user = await sessionUser(database, now, c);
    if (!user) return c.json({ error: "Not logged in" }, 401);
    const [kitchen] = await db
      .select({ id: kitchens.id, name: kitchens.name, kids: kitchens.kids, nemligOn: kitchens.nemligOn })
      .from(kitchenMembers)
      .innerJoin(kitchens, eq(kitchens.id, kitchenMembers.kitchenId))
      .where(eq(kitchenMembers.userId, user.id))
      .limit(1);
    return c.json({ username: user.username, language: user.language === "da" ? "da" : "en", kitchen: kitchen ?? null });
  });

  routes.post("/api/logout", async (c) => {
    const token = getCookie(c, sessionCookie);
    if (token) await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
    deleteCookie(c, sessionCookie, { path: "/", secure: publicUrl.protocol === "https:" });
    return c.body(null, 204);
  });

  return routes;
}

export async function startSession({ database, now, publicUrl }: Pick<AppDependencies, "database" | "now" | "publicUrl">, c: Context, userId: string, authMethod: AuthMethod) {
  const { db } = database;
  const token = randomBytes(32).toString("base64url");
  const createdAt = now();
  const replaced = getCookie(c, sessionCookie);
  const expired = lte(sessions.expiresAt, createdAt);
  await db.delete(sessions).where(replaced ? or(expired, eq(sessions.tokenHash, sha256(replaced))) : expired);
  await db.insert(sessions).values({
    tokenHash: sha256(token),
    userId,
    createdAt,
    expiresAt: new Date(createdAt.getTime() + sessionLifetime),
    lastUsedAt: createdAt,
    userAgent: (c.req.header("user-agent") ?? "").slice(0, 300),
    authenticatedAt: createdAt,
    authMethod,
  });
  setCookie(c, sessionCookie, token, { httpOnly: true, sameSite: "Lax", path: "/", maxAge: sessionLifetime / 1000, secure: publicUrl.protocol === "https:" });
}

/** The user and device behind the cookie. Marks the device as used, but writes at most once an hour. */
export async function currentSession({ db }: Database, now: () => Date, c: Context) {
  const token = getCookie(c, sessionCookie);
  if (!token) return undefined;
  const tokenHash = sha256(token);
  const [row] = await db
    .select({
      user: users,
      id: sessions.id,
      lastUsedAt: sessions.lastUsedAt,
      authenticatedAt: sessions.authenticatedAt,
      authMethod: sessions.authMethod,
      hasPasskey: sql<boolean>`exists (select 1 from ${passkeys} where ${passkeys.userId} = ${users.id})`,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now())));
  if (!row) return undefined;
  const anHourAgo = new Date(now().getTime() - hour);
  if (row.lastUsedAt < anHourAgo) {
    await db.update(sessions).set({ lastUsedAt: now() }).where(and(eq(sessions.tokenHash, tokenHash), lt(sessions.lastUsedAt, anHourAgo)));
  }
  const session: Session = { id: row.id, authenticatedAt: row.authenticatedAt, authMethod: row.authMethod === "passkey" ? "passkey" : "password", hasPasskey: row.hasPasskey };
  return { user: row.user, session };
}

export async function sessionUser(database: Database, now: () => Date, c: Context) {
  return (await currentSession(database, now, c))?.user;
}
