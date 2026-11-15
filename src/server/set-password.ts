// Sets one login's password. Run inside the app's container:
//   NEW_PASSWORD=carrotmango node src/server/set-password.ts isabel
import { eq } from "drizzle-orm";
import { connectDatabase } from "./db.ts";
import { hashPassword } from "./passwords.ts";
import { users } from "./schema.ts";

const [username] = process.argv.slice(2);
const password = process.env.NEW_PASSWORD;
const databaseUrl = process.env.DATABASE_URL;
if (!username || !password || !databaseUrl) {
  console.error("Usage: NEW_PASSWORD=<password> node src/server/set-password.ts <username> (DATABASE_URL must be set)");
  process.exit(1);
}
const database = connectDatabase(databaseUrl);
const updated = await database.db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.username, username)).returning({ id: users.id });
await database.close();
if (updated.length === 0) {
  console.error(`No login called ${username}.`);
  process.exit(1);
}
console.log(`New password set for ${username}.`);
