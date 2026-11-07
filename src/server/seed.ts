import { eq } from "drizzle-orm";
import type { Database } from "./db.ts";
import { hashPassword } from "./passwords.ts";
import { kitchenMembers, kitchens, users } from "./schema.ts";

/** Starting passwords by username. A missing password skips that user. */
export type SeedUsers = Record<string, string | undefined>;

/**
 * Makes sure the kitchen "Home" and each user exist, and that every seeded user is in the kitchen.
 * An existing user keeps the password they have now, even if the env says something else.
 */
export async function seed({ db }: Database, seedUsers: SeedUsers) {
  let [kitchen] = await db.select({ id: kitchens.id }).from(kitchens).limit(1);
  kitchen ??= (await db.insert(kitchens).values({ name: "Home" }).returning({ id: kitchens.id }))[0]!;

  for (const [username, password] of Object.entries(seedUsers)) {
    let [user] = await db.select({ id: users.id }).from(users).where(eq(users.username, username));
    if (!user) {
      if (!password) {
        console.warn(`No starting password for ${username}, so that account was not created.`);
        continue;
      }
      [user] = await db
        .insert(users)
        .values({ username, passwordHash: await hashPassword(password) })
        .onConflictDoNothing()
        .returning({ id: users.id });
      user ??= (await db.select({ id: users.id }).from(users).where(eq(users.username, username)))[0]!;
    }
    await db.insert(kitchenMembers).values({ kitchenId: kitchen.id, userId: user.id }).onConflictDoNothing();
  }
}
