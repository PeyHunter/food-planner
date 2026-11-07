import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, inject } from "vitest";
import { createApp } from "../../src/server/app.ts";
import { connectDatabase, migrate } from "../../src/server/db.ts";
import { ensureHousehold, type StartingUser } from "../../src/server/household.ts";

export const startingUsers: StartingUser[] = [
  { username: "peyton", password: randomUUID() },
  { username: "ronja", password: randomUUID() },
];

/**
 * Starts the app against a brand-new PostgreSQL database with peyton and ronja in one Kitchen.
 * Tests talk to it only through `request`, the same HTTP API the phone UI uses.
 */
export async function createTestApp({ publicUrl = "http://localhost" }: { publicUrl?: string } = {}) {
  const serverUrl = inject("postgresUrl");
  const name = `test_${randomUUID().replaceAll("-", "")}`;
  const admin = new pg.Client({ connectionString: `${serverUrl}/postgres` });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();

  const database = connectDatabase(`${serverUrl}/${name}`);
  await migrate(database);
  await ensureHousehold(database, startingUsers);
  let now = new Date("2026-03-01T12:00:00Z");
  const app = createApp({ database, now: () => now, publicUrl: new URL(publicUrl), photosDir: inject("scratchDir") });
  afterAll(() => database.close());

  return {
    database,
    request: (path: string, init?: RequestInit) => app.request(path, init),
    async query<Row extends Record<string, unknown>>(text: string, values: unknown[] = []) {
      return (await database.db.$client.query<Row>(text, values)).rows;
    },
    clock: {
      advance(ms: number) {
        now = new Date(now.getTime() + ms);
      },
    },
    async logIn(username: string, password: string) {
      const response = await app.request("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const setCookie = response.headers.getSetCookie().find((cookie) => cookie.startsWith("fp_session=")) ?? null;
      return { response, setCookie, cookie: setCookie?.split(";")[0] };
    },
  };
}

export const days = (count: number) => count * 24 * 60 * 60 * 1000;
