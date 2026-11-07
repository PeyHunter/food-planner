import { randomUUID } from "node:crypto";

/**
 * Throwaway passwords for one browser test run. playwright.config.ts picks them once; the web server and the
 * test workers inherit them through the environment, so every process sees the same ones.
 */
export function e2eLogins() {
  process.env.E2E_LOGINS ??= JSON.stringify({ peyton: randomUUID(), ronja: randomUUID() });
  return JSON.parse(process.env.E2E_LOGINS) as { peyton: string; ronja: string };
}
