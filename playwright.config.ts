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
    { name: "iphone", use: iPhone, testIgnore: ["browse.spec.ts", "freezer.spec.ts"] },
    // Browse plans next week's Wednesday in the same kitchen as week.spec.ts, so it runs after the rest.
    { name: "iphone-browse", use: iPhone, testMatch: "browse.spec.ts", dependencies: ["iphone"] },
    // Create week takes freezer portions, which would change what week.spec.ts and browse.spec.ts see, so the freezer runs last.
    { name: "iphone-freezer", use: iPhone, testMatch: "freezer.spec.ts", dependencies: ["iphone-browse"] },
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
