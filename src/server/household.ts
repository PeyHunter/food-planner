import { eq, inArray, sql } from "drizzle-orm";
import type { Language } from "../shared/profile.ts";
import type { Database } from "./db.ts";
import { hashPassword } from "./passwords.ts";
import { children, kitchenMembers, kitchens, rules, users } from "./schema.ts";

export type StartingUser = { username: string; password: string };
/** kids: the children's names, given to the kitchen when it is made; empty means a kitchen without kids. language: new logins start in it. */
export type StartingKitchen = { name: string; kids: string[]; language: Language };

/**
 * Makes sure every starting user exists and that they all share one Kitchen, and returns the kitchen's id.
 * A user who already exists keeps their password and language: the env value is only used the first time.
 */
export async function ensureHousehold(database: Database, people: StartingUser[], kitchen: StartingKitchen = { name: "Our kitchen", kids: ["Runi Lee"], language: "en" }) {
  const { db } = database;
  const kitchenId = await db.transaction(async (tx) => {
    for (const person of people) {
      const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.username, person.username));
      if (!existing) await tx.insert(users).values({ username: person.username, passwordHash: await hashPassword(person.password), language: kitchen.language });
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
    // An existing kitchen keeps its own "kids" setting and children: both can be changed in the app.
    let kitchenId = shared?.kitchenId;
    if (!kitchenId) {
      kitchenId = (await tx.insert(kitchens).values({ name: kitchen.name, kids: kitchen.kids.length > 0 }).returning({ id: kitchens.id }))[0]!.id;
      if (kitchen.kids.length) await tx.insert(children).values(kitchen.kids.map((name) => ({ kitchenId: kitchenId!, name })));
    }
    await tx
      .insert(kitchenMembers)
      .values(members.map((member) => ({ kitchenId: kitchenId!, userId: member.id })))
      .onConflictDoNothing();
    return kitchenId;
  });
  await ensureKitchenDefaults(database);
  return kitchenId;
}

/** A kitchen with no rules gets the spec's starting rules: the adults' ones, and the child ones for each of its children. */
export async function ensureKitchenDefaults({ db }: Database) {
  await db.transaction(async (tx) => {
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
      const kitchenChildren = await tx.select({ id: children.id }).from(children).where(eq(children.kitchenId, kitchenId));
      await tx.insert(rules).values([
        ...adultRules,
        ...kitchenChildren.flatMap(({ id: childId }) => [
          { kitchenId, childId, op: "at-least", n: 2, what: "Fish" },
          { kitchenId, childId, op: "at-most", n: 1, what: "Meat" },
          { kitchenId, childId, op: "at-least", n: 5, what: "Vegetables" },
        ]),
      ]);
    }
  });
}
