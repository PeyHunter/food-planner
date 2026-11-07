import { randomUUID } from "node:crypto";

// Made once in the Playwright runner when it loads the config; the server and the workers inherit them through env.
process.env.E2E_PEYTON_PASSWORD ??= randomUUID();
process.env.E2E_RONJA_PASSWORD ??= randomUUID();

/** Throwaway passwords for the local browser tests' own database. */
export const e2ePasswords = { peyton: process.env.E2E_PEYTON_PASSWORD, ronja: process.env.E2E_RONJA_PASSWORD };
