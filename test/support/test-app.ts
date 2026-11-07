import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, inject } from "vitest";
import { createApp } from "../../src/server/app.ts";
import { connectDatabase, migrate } from "../../src/server/db.ts";

/** A brand-new, migrated PostgreSQL database for one test file. */
export async function createTestDatabase() {
  const serverUrl = inject("postgresUrl");
  const name = `test_${randomUUID().replaceAll("-", "")}`;
  const admin = new pg.Client({ connectionString: `${serverUrl}/postgres` });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();

  const database = connectDatabase(`${serverUrl}/${name}`);
  await migrate(database);
  afterAll(() => database.close());
  return database;
}

/** Starts the app against a fresh database. Tests talk to it only through `request`, the same HTTP API the web app uses. */
export async function createTestApp() {
  const database = await createTestDatabase();
  let now = new Date("2026-11-07T12:00:00Z");
  const app = createApp({ database, now: () => now, secureCookies: false });
  return {
    database,
    request: (path: string, init?: RequestInit) => app.request(path, init),
    clock: {
      advance(ms: number) {
        now = new Date(now.getTime() + ms);
      },
    },
  };
}

export function cookieFrom(response: Response, name: string) {
  return response.headers.getSetCookie().find((cookie) => cookie.startsWith(`${name}=`));
}

export const days = (count: number) => count * 24 * 60 * 60 * 1000;
