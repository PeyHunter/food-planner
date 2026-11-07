import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lte } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Database } from "./db.ts";
import { hashPassword, verifyPassword } from "./passwords.ts";
import { kitchenMembers, kitchens, sessions, users } from "./schema.ts";

const minute = 60 * 1000;
const day = 24 * 60 * minute;
// Browsers cap a cookie's Max-Age at 400 days.
export const sessionLifetime = 400 * day;
export const sessionCookie = "fp_session";
const failedLoginLimit = { count: 10, windowMs: 15 * minute };

export type AuthDependencies = { database: Database; now: () => Date; secureCookies: boolean };

const sha256 = (value: string) => createHash("sha256").update(value).digest("base64url");

export function createAuthRoutes({ database, now, secureCookies }: AuthDependencies) {
  const { db } = database;
  const routes = new Hono();
  const failures = createFailureCounter(() => now().getTime());
  // Unknown usernames are checked against this, so a wrong username takes as long as a wrong password.
  const decoyHash = hashPassword(randomBytes(16).toString("hex"));

  routes.post("/api/login", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { username?: unknown; password?: unknown };
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!username || !password) return c.json({ error: "Type your username and password." }, 400);
    if (!failures.hasRoom(username)) return c.json({ error: "Too many wrong tries. Wait 15 minutes and try again." }, 429);

    const [user] = await db.select().from(users).where(eq(users.username, username));
    const ok = await verifyPassword(password, user?.passwordHash ?? (await decoyHash));
    if (!user || !ok) {
      failures.add(username);
      return c.json({ error: "That username or password is wrong." }, 401);
    }

    const token = randomBytes(32).toString("base64url");
    const createdAt = now();
    await db.delete(sessions).where(lte(sessions.expiresAt, createdAt));
    await db.insert(sessions).values({ tokenHash: sha256(token), userId: user.id, createdAt, expiresAt: new Date(createdAt.getTime() + sessionLifetime) });
    setCookie(c, sessionCookie, token, { httpOnly: true, sameSite: "Lax", path: "/", maxAge: sessionLifetime / 1000, secure: secureCookies });
    return c.json({ username: user.username });
  });

  routes.post("/api/logout", async (c) => {
    const token = getCookie(c, sessionCookie);
    if (token) await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
    deleteCookie(c, sessionCookie, { path: "/", secure: secureCookies });
    return c.body(null, 204);
  });

  routes.get("/api/me", async (c) => {
    const user = await sessionUser(database, now, c);
    if (!user) return c.json({ error: "Not logged in" }, 401);
    const [kitchen] = await db
      .select({ id: kitchens.id, name: kitchens.name })
      .from(kitchenMembers)
      .innerJoin(kitchens, eq(kitchens.id, kitchenMembers.kitchenId))
      .where(eq(kitchenMembers.userId, user.id));
    return c.json({ username: user.username, kitchen: kitchen ?? null });
  });

  return routes;
}

export async function sessionUser({ db }: Database, now: () => Date, c: Context) {
  const token = getCookie(c, sessionCookie);
  if (!token) return undefined;
  const [row] = await db
    .select({ id: users.id, username: users.username })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, now())));
  return row;
}

/** Counts wrong passwords per username in fixed windows. Windows are kept in start order, so the sweep stops at the first live one. */
function createFailureCounter(clock: () => number) {
  const windows = new Map<string, { start: number; count: number }>();
  const current = (key: string) => {
    const at = clock();
    for (const [stale, window] of windows) {
      if (at - window.start < failedLoginLimit.windowMs) break;
      windows.delete(stale);
    }
    return windows.get(key);
  };
  return {
    hasRoom: (key: string) => (current(key)?.count ?? 0) < failedLoginLimit.count,
    add(key: string) {
      const window = current(key);
      if (window) window.count += 1;
      else windows.set(key, { start: clock(), count: 1 });
    },
  };
}
