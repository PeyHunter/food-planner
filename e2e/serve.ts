import { join } from "node:path";
import { startThrowawayPostgres } from "../test/support/throwaway-postgres.ts";
import { e2ePasswords } from "./passwords.ts";

// Starts a throwaway PostgreSQL, then the real server against it, for Playwright.
const postgres = await startThrowawayPostgres("e2e-pg");
await postgres.createDatabase("food_planner");

process.env.DATABASE_URL = `${postgres.url}/food_planner`;
process.env.PHOTOS_DIR = join(postgres.dir, "photos");
process.env.PEYTON_PASSWORD = e2ePasswords.peyton;
process.env.RONJA_PASSWORD = e2ePasswords.ronja;
await import("../src/server/main.ts");
