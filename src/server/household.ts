import { eq, inArray } from "drizzle-orm";
import type { Database } from "./db.ts";
import { hashPassword } from "./passwords.ts";
import { kitchenMembers, kitchens, users } from "./schema.ts";

export type StartingUser = { username: string; password: string };

/**
 * Makes sure every starting user exists and that they all share one Kitchen.
 * A user who already exists keeps their password: the env value is only used the first time.
 */
export async function ensureHousehold({ db }: Database, people: StartingUser[]) {
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
    const kitchenId = shared?.kitchenId ?? (await tx.insert(kitchens).values({ name: "Our kitchen" }).returning({ id: kitchens.id }))[0]!.id;
    await tx
      .insert(kitchenMembers)
      .values(members.map((member) => ({ kitchenId, userId: member.id })))
      .onConflictDoNothing();
  });
}
