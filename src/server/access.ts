import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lte, or } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AppDependencies } from "./app.ts";
import type { Database } from "./db.ts";
import { checkPassword } from "./passwords.ts";
import { kitchenMembers, kitchens, sessions, users } from "./schema.ts";

const minute = 60 * 1000;
const day = 24 * 60 * minute;
// Browsers cap a cookie's Max-Age at 400 days.
const sessionLifetime = 400 * day;
export const sessionCookie = "fp_session";
// The site is public, so wrong passwords for one username are capped to slow down guessing.
const maxFailures = 10;
const failureWindow = 15 * minute;

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export function createAccessRoutes({ database, now, publicUrl }: AppDependencies) {
  const { db } = database;
  const secure = publicUrl.protocol === "https:";
  const routes = new Hono();
  const failures = new Map<string, number[]>();

  const recentFailures = (username: string) => {
    const since = now().getTime() - failureWindow;
    const recent = (failures.get(username) ?? []).filter((time) => time > since);
    failures.set(username, recent);
    return recent;
  };

  routes.post("/api/login", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { username?: unknown; password?: unknown };
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (recentFailures(username).length >= maxFailures) {
      return c.json({ error: "Too many wrong tries. Wait 15 minutes and try again." }, 429);
    }
    const [user] = username ? await db.select().from(users).where(eq(users.username, username)) : [];
    if (!user || !(await checkPassword(password, user.passwordHash))) {
      recentFailures(username).push(now().getTime());
      return c.json({ error: "Wrong name or password." }, 401);
    }
    failures.delete(username);
    await startSession(c, user.id);
    return c.body(null, 204);
  });

  routes.get("/api/me", async (c) => {
    const user = await sessionUser(database, now, c);
    if (!user) return c.json({ error: "Not logged in" }, 401);
    const [kitchen] = await db
      .select({ id: kitchens.id, name: kitchens.name })
      .from(kitchenMembers)
      .innerJoin(kitchens, eq(kitchens.id, kitchenMembers.kitchenId))
      .where(eq(kitchenMembers.userId, user.id))
      .limit(1);
    return c.json({ username: user.username, kitchen: kitchen ?? null });
  });

  routes.post("/api/logout", async (c) => {
    const token = getCookie(c, sessionCookie);
    if (token) await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
    deleteCookie(c, sessionCookie, { path: "/", secure });
    return c.body(null, 204);
  });

  async function startSession(c: Context, userId: string) {
    const token = randomBytes(32).toString("base64url");
    const createdAt = now();
    const replaced = getCookie(c, sessionCookie);
    const expired = lte(sessions.expiresAt, createdAt);
    await db.delete(sessions).where(replaced ? or(expired, eq(sessions.tokenHash, sha256(replaced))) : expired);
    await db.insert(sessions).values({ tokenHash: sha256(token), userId, createdAt, expiresAt: new Date(createdAt.getTime() + sessionLifetime) });
    setCookie(c, sessionCookie, token, { httpOnly: true, sameSite: "Lax", path: "/", maxAge: sessionLifetime / 1000, secure });
  }

  return routes;
}

export async function sessionUser({ db }: Database, now: () => Date, c: Context) {
  const token = getCookie(c, sessionCookie);
  if (!token) return undefined;
  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, now())));
  return row?.user;
}
