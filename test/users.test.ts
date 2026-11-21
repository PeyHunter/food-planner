import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";
import { ensureHousehold } from "../src/server/household.ts";
import { hashPassword } from "../src/server/passwords.ts";
import { createTestApp, startingUsers } from "./support/test-app.ts";

test("startup creates peyton and ronja in one shared kitchen", async () => {
  const app = await createTestApp();

  const rows = await app.query<{ username: string; kitchen_id: string }>(
    "select u.username, m.kitchen_id from users u join kitchen_members m on m.user_id = u.id order by u.username",
  );
  expect(rows.map((row) => row.username)).toEqual(["peyton", "ronja"]);
  expect(rows[0]!.kitchen_id).toBe(rows[1]!.kitchen_id);
  expect(await app.query("select * from kitchens")).toHaveLength(1);
});

test("starting again never overwrites a password and never adds a second kitchen", async () => {
  const app = await createTestApp();
  const changedLater = randomUUID();
  const newEnvValue = randomUUID();
  await app.query("update users set password_hash = $1 where username = 'peyton'", [await hashPassword(changedLater)]);

  await ensureHousehold(
    app.database,
    startingUsers.map(({ username }) => ({ username, password: newEnvValue })),
  );

  expect((await app.logIn("peyton", changedLater)).response.status).toBe(204);
  expect((await app.logIn("peyton", newEnvValue)).response.status).toBe(401);
  expect((await app.logIn("ronja", startingUsers[1]!.password)).response.status).toBe(204);
  expect(await app.query("select * from kitchens")).toHaveLength(1);
  expect(await app.query("select * from kitchen_members")).toHaveLength(2);
});

test("a missing user is created again and joins the existing kitchen", async () => {
  const app = await createTestApp();
  await app.query("delete from users where username = 'ronja'");

  await ensureHousehold(app.database, startingUsers);

  const rows = await app.query<{ kitchen_id: string }>("select kitchen_id from kitchen_members");
  expect(rows).toHaveLength(2);
  expect(new Set(rows.map((row) => row.kitchen_id)).size).toBe(1);
  expect((await app.logIn("ronja", startingUsers[1]!.password)).response.status).toBe(204);
});

test("passwords are stored hashed, never as plain text", async () => {
  const app = await createTestApp();
  const [row] = await app.query<{ password_hash: string }>("select password_hash from users where username = 'peyton'");
  expect(row!.password_hash).toMatch(/^scrypt\$/);
  expect(row!.password_hash).not.toContain(startingUsers[0]!.password);
});

test("isabel and christopher get their own kitchen with no children and only adult rules", async () => {
  const app = await createTestApp();
  const family = [
    { username: "isabel", password: randomUUID() },
    { username: "christopher", password: randomUUID() },
  ];
  await ensureHousehold(app.database, family, { name: "Isabel and Christopher's kitchen", kids: [], language: "en" });
  await ensureHousehold(app.database, family, { name: "Isabel and Christopher's kitchen", kids: [], language: "en" });

  const members = await app.query<{ username: string; kitchen_id: string; kids: boolean }>(
    "select u.username, m.kitchen_id, k.kids from users u join kitchen_members m on m.user_id = u.id join kitchens k on k.id = m.kitchen_id order by u.username",
  );
  const kitchenOf = Object.fromEntries(members.map((row) => [row.username, row]));
  expect(kitchenOf.isabel!.kitchen_id).toBe(kitchenOf.christopher!.kitchen_id);
  expect(kitchenOf.isabel!.kitchen_id).not.toBe(kitchenOf.peyton!.kitchen_id);
  expect(kitchenOf.isabel!.kids).toBe(false);
  expect(kitchenOf.peyton!.kids).toBe(true);
  expect(await app.query("select * from children where kitchen_id = $1", [kitchenOf.isabel!.kitchen_id])).toHaveLength(0);
  const rules = await app.query<{ child_id: string | null }>("select child_id from rules where kitchen_id = $1", [kitchenOf.isabel!.kitchen_id]);
  expect(rules).toHaveLength(2);
  expect(rules.every((rule) => rule.child_id === null)).toBe(true);

  const cookie = (await app.logIn("isabel", family[0]!.password)).cookie!;
  const me = await (await app.request("/api/me", { headers: { cookie } })).json();
  expect(me.kitchen.kids).toBe(false);
  expect(await (await app.request("/api/children", { headers: { cookie } })).json()).toEqual([]);
  const added = await app.request("/api/children", { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ name: "Nope", birthday: null }) });
  expect(added.status).toBe(403);
  const week = await (await app.request("/api/plan/weeks/2026-03-02", { headers: { cookie } })).json();
  expect(week.children).toEqual([]);
});

test("set-password gives an existing login a new password", async () => {
  const app = await createTestApp();
  const run = promisify(execFile);
  await run("node", ["src/server/set-password.ts", "ronja"], { env: { ...process.env, DATABASE_URL: app.databaseUrl, NEW_PASSWORD: "carrotmango" } });

  expect((await app.logIn("ronja", "carrotmango")).response.status).toBe(204);
  expect((await app.logIn("ronja", startingUsers[1]!.password)).response.status).toBe(401);
  await expect(run("node", ["src/server/set-password.ts", "nobody"], { env: { ...process.env, DATABASE_URL: app.databaseUrl, NEW_PASSWORD: "peapear" } })).rejects.toThrow(/No login called nobody/);
});
