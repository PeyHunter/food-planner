import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { hashPassword, verifyPassword } from "../src/server/passwords.ts";
import { kitchenMembers, kitchens, users } from "../src/server/schema.ts";
import { seed } from "../src/server/seed.ts";
import { createTestDatabase } from "./support/test-app.ts";

test("seeding creates the Home kitchen with peyton and ronja in it", async () => {
  const database = await createTestDatabase();
  await seed(database, { peyton: "pey-pass", ronja: "ron-pass" });

  const { db } = database;
  expect(await db.select({ name: kitchens.name }).from(kitchens)).toEqual([{ name: "Home" }]);
  const rows = await db.select({ username: users.username, hash: users.passwordHash, role: kitchenMembers.role }).from(users).innerJoin(kitchenMembers, eq(kitchenMembers.userId, users.id));
  expect(rows.map((row) => row.username).sort()).toEqual(["peyton", "ronja"]);
  const peyton = rows.find((row) => row.username === "peyton")!;
  expect(peyton.hash).toMatch(/^scrypt\$/);
  expect(peyton.hash).not.toContain("pey-pass");
  expect(await verifyPassword("pey-pass", peyton.hash)).toBe(true);
});

test("seeding again never overwrites a changed password and adds no second kitchen", async () => {
  const database = await createTestDatabase();
  const { db } = database;
  await seed(database, { peyton: "first", ronja: "ron-pass" });
  await db.update(users).set({ passwordHash: await hashPassword("changed-later") }).where(eq(users.username, "peyton"));

  await seed(database, { peyton: "first", ronja: "something-else" });

  const [peyton] = await db.select().from(users).where(eq(users.username, "peyton"));
  expect(await verifyPassword("changed-later", peyton!.passwordHash)).toBe(true);
  expect(await verifyPassword("first", peyton!.passwordHash)).toBe(false);
  const [ronja] = await db.select().from(users).where(eq(users.username, "ronja"));
  expect(await verifyPassword("ron-pass", ronja!.passwordHash)).toBe(true);
  expect(await db.select().from(kitchens)).toHaveLength(1);
  expect(await db.select().from(kitchenMembers)).toHaveLength(2);
});

test("a user without a starting password is skipped", async () => {
  const database = await createTestDatabase();
  await seed(database, { peyton: "pey-pass", ronja: undefined });
  expect((await database.db.select({ username: users.username }).from(users)).map((row) => row.username)).toEqual(["peyton"]);
});
