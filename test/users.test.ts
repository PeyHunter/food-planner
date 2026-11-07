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
