import { asc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "./db.ts";
import { hashPassword } from "./passwords.ts";
import { children, kitchenMembers, kitchens, rules, users } from "./schema.ts";

export type StartingUser = { username: string; password: string };
export type StartingKitchen = { name: string; kids: boolean };

/**
 * Makes sure every starting user exists and that they all share one Kitchen.
 * A user who already exists keeps their password: the env value is only used the first time.
 */
export async function ensureHousehold(database: Database, people: StartingUser[], kitchen: StartingKitchen = { name: "Our kitchen", kids: true }) {
  const { db } = database;
  await db.transaction(async (tx) => {
    for (const person of people) {
      const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.username, person.username));
      if (!existing) await tx.insert(users).values({ username: person.username, passwordHash: await hashPassword(person.password) });
    }
    const members = await tx
      .select({ id: users.id })
      .from(users)
      .where(
        inArray(
          users.username,
          people.map((person) => person.username),
        ),
      );
    const [shared] = await tx
      .select({ kitchenId: kitchenMembers.kitchenId })
      .from(kitchenMembers)
      .where(
        inArray(
          kitchenMembers.userId,
          members.map((member) => member.id),
        ),
      )
      .limit(1);
    const kitchenId = shared?.kitchenId ?? (await tx.insert(kitchens).values(kitchen).returning({ id: kitchens.id }))[0]!.id;
    // An existing kitchen keeps its own "kids" setting: it can be changed on the Profile page.
    await tx
      .insert(kitchenMembers)
      .values(members.map((member) => ({ kitchenId, userId: member.id })))
      .onConflictDoNothing();
  });
  await ensureKitchenDefaults(database);
}

/** A kitchen with kids but no children gets Runi Lee; a kitchen with no rules gets the spec's starting rules (adult ones only without kids). */
export async function ensureKitchenDefaults({ db }: Database) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`insert into ${children} (kitchen_id, name)
      select k.id, 'Runi Lee' from ${kitchens} k where k.kids and not exists (select 1 from ${children} c where c.kitchen_id = k.id)`);
    const bare = await tx
      .select({ id: kitchens.id, kids: kitchens.kids })
      .from(kitchens)
      .where(sql`not exists (select 1 from ${rules} r where r.kitchen_id = ${kitchens.id})`);
    for (const { id: kitchenId, kids } of bare) {
      const adultRules = [
        { kitchenId, childId: null, op: "at-least", n: 1, what: "Fish" },
        { kitchenId, childId: null, op: "at-least", n: 1, what: "Freezable" },
      ];
      if (!kids) {
        await tx.insert(rules).values(adultRules);
        continue;
      }
      const [first] = await tx.select({ id: children.id }).from(children).where(eq(children.kitchenId, kitchenId)).orderBy(asc(children.createdAt), asc(children.id)).limit(1);
      const childId = first!.id;
      await tx.insert(rules).values([
        ...adultRules,
        { kitchenId, childId, op: "at-least", n: 2, what: "Fish" },
        { kitchenId, childId, op: "at-most", n: 1, what: "Meat" },
        { kitchenId, childId, op: "at-least", n: 5, what: "Vegetables" },
      ]);
    }
  });
}
