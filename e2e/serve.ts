import { join } from "node:path";
import { startThrowawayPostgres } from "../test/support/throwaway-postgres.ts";
import { e2eLogins } from "./logins.ts";

// Starts a throwaway PostgreSQL, then the real server against it, for Playwright.
const postgres = await startThrowawayPostgres("e2e-pg");
await postgres.createDatabase("food_planner");

process.env.DATABASE_URL = `${postgres.url}/food_planner`;
process.env.PHOTOS_DIR = join(postgres.dir, "photos");
process.env.PEYTON_PASSWORD = e2eLogins().peyton;
process.env.RONJA_PASSWORD = e2eLogins().ronja;
await import("../src/server/main.ts");
