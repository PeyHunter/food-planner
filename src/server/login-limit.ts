import { and, count, eq, gt, inArray, lte } from "drizzle-orm";
import type { Context } from "hono";
import { getConnInfo } from "@hono/node-server/conninfo";
import type { Database } from "./db.ts";
import { loginFailures } from "./schema.ts";

const minute = 60 * 1000;
export const maxFailures = 10;
export const failureWindow = 15 * minute;
export const tooManyTries = "Too many wrong tries. Wait 15 minutes and try again.";

/**
 * The address the request came from. Behind Traefik the socket is Traefik, so the last X-Forwarded-For entry
 * (the one Traefik added) is the phone's address; anything before it was written by the client and can be made up.
 */
export function clientIp(c: Context) {
  const forwarded = c.req.header("x-forwarded-for")?.split(",").at(-1)?.trim();
  if (forwarded) return forwarded;
  try {
    return getConnInfo(c).remote.address ?? "unknown";
  } catch {
    return "unknown";
  }
}

export const limitKeys = (ip: string, username?: string) => [`ip:${ip}`, ...(username ? [`name:${username}`] : [])];

/** At most 10 failed logins per name and per address in 15 minutes. Kept in PostgreSQL so a restart doesn't reset it. */
export function loginLimit({ db }: Database, now: () => Date) {
  const since = () => new Date(now().getTime() - failureWindow);
  return {
    async blocked(keys: string[]) {
      const rows = await db
        .select({ key: loginFailures.key, failures: count() })
        .from(loginFailures)
        .where(and(inArray(loginFailures.key, keys), gt(loginFailures.failedAt, since())))
        .groupBy(loginFailures.key);
      return rows.some((row) => row.failures >= maxFailures);
    },
    async fail(keys: string[]) {
      await db.delete(loginFailures).where(lte(loginFailures.failedAt, since()));
      await db.insert(loginFailures).values(keys.map((key) => ({ key, failedAt: now() })));
    },
    async clear(keys: string[]) {
      await db.delete(loginFailures).where(inArray(loginFailures.key, keys));
    },
  };
}
export type LoginLimit = ReturnType<typeof loginLimit>;
