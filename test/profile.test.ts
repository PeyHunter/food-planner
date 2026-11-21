import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";
import type { Profile } from "../src/shared/profile.ts";
import type { WeekView } from "../src/shared/week.ts";
import { ensureHousehold } from "../src/server/household.ts";
import { createTestApp, startingUsers } from "./support/test-app.ts";

async function loggedIn(username = "peyton", password = startingUsers[0]!.password, app?: Awaited<ReturnType<typeof createTestApp>>) {
  app ??= await createTestApp();
  const { cookie } = await app.logIn(username, password);
  const call = async (path: string, method = "GET", body?: unknown) =>
    app.request(path, { method, headers: { cookie: cookie!, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { app, call };
}

test("language is your own; kids and nemlig.com are the kitchen's", async () => {
  const { app, call } = await loggedIn();
  const ronja = await loggedIn("ronja", startingUsers[1]!.password, app);
  expect(await (await call("/api/profile")).json()).toEqual({ language: "en", kids: true, nemlig: { on: false, day: 6, organic: false } });

  const changed = await call("/api/profile", "PUT", { language: "da", nemlig: { on: true, day: 6, organic: true } });
  expect(await changed.json()).toEqual({ language: "da", kids: true, nemlig: { on: true, day: 6, organic: true } });
  const theirs = (await (await ronja.call("/api/profile")).json()) as Profile;
  expect(theirs).toEqual({ language: "en", kids: true, nemlig: { on: true, day: 6, organic: true } });
  expect(await (await call("/api/me")).json()).toMatchObject({ language: "da", kitchen: { nemligOn: true } });

  expect((await call("/api/profile", "PUT", { language: "fr" })).status).toBe(400);
  expect((await call("/api/profile", "PUT", { nemlig: { day: 7 } })).status).toBe(400);
});

test("a kitchen without kids can say it has a child, and keeps that after a restart", async () => {
  const app = await createTestApp();
  const people = [
    { username: "isabel", password: randomUUID() },
    { username: "christopher", password: randomUUID() },
  ];
  await ensureHousehold(app.database, people, { name: "Isabel's", kids: [], language: "en" });
  const { call } = await loggedIn("isabel", people[0]!.password, app);
  expect(((await (await call("/api/profile", "PUT", { kids: true })).json()) as Profile).kids).toBe(true);
  await ensureHousehold(app.database, people, { name: "Isabel's", kids: [], language: "en" });
  const week = (await (await call("/api/plan/weeks/2026-03-02")).json()) as WeekView;
  expect(week.children.map((child) => child.name)).toEqual(["Baby"]);
  expect(((await (await call("/api/profile")).json()) as Profile).kids).toBe(true);
});
