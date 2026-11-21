import { defineConfig, devices } from "@playwright/test";
import "./e2e/passwords.ts";

// Set E2E_PORT to a unique value when several checkouts run browser tests at once.
const port = Number(process.env.E2E_PORT ?? 4173);
// iPhone screen size and touch; Chromium stands in for Safari so it runs without system packages.
const iPhone = { ...devices["iPhone 15"], defaultBrowserType: "chromium" as const };

export default defineConfig({
  testDir: "e2e",
  use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure" },
  projects: [
    { name: "iphone", use: iPhone, testIgnore: ["browse.spec.ts", "danish.spec.ts", "nemlig.spec.ts"] },
    // Browse plans next week's Wednesday in the same kitchen as week.spec.ts, so it runs after the rest.
    { name: "iphone-browse", use: iPhone, testMatch: "browse.spec.ts", dependencies: ["iphone"] },
    // Sets up nemlig.com for the kitchen from scratch, so it runs alone.
    { name: "iphone-nemlig", use: iPhone, testMatch: "nemlig.spec.ts", dependencies: ["iphone-browse"] },
    // Switches peyton to Danish and turns on nemlig.com for the kitchen, so it runs last, alone.
    { name: "iphone-danish", use: iPhone, testMatch: "danish.spec.ts", dependencies: ["iphone-nemlig"] },
  ],
  webServer: {
    command: "npm run build && node e2e/serve.ts",
    url: `http://localhost:${port}/api/health`,
    env: { PORT: String(port) },
    // Never reuse: a server already on this port may be another checkout running other code.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
