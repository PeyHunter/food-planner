import { mkdir } from "node:fs/promises";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createApp } from "./app.ts";
import { connectDatabase, migrate } from "./db.ts";
import { seed } from "./seed.ts";

const { DATABASE_URL, PORT, PHOTOS_DIR, NODE_ENV, PEYTON_PASSWORD, RONJA_PASSWORD } = process.env;
if (!DATABASE_URL) {
  console.error("food-planner cannot start: DATABASE_URL is not set.");
  process.exit(1);
}
if (PHOTOS_DIR) await mkdir(PHOTOS_DIR, { recursive: true });

const database = connectDatabase(DATABASE_URL);
await migrate(database);
await seed(database, { peyton: PEYTON_PASSWORD, ronja: RONJA_PASSWORD });

const app = createApp({ database, now: () => new Date(), secureCookies: NODE_ENV === "production" });
app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));
// The built web app; any other path falls back to the single page.
app.use("/assets/*", serveStatic({ root: "dist/web", onFound: (_path, c) => c.header("Cache-Control", "public, max-age=31536000, immutable") }));
app.use("*", serveStatic({ root: "dist/web" }));
app.get("*", serveStatic({ path: "dist/web/index.html" }));

const server = serve({ fetch: app.fetch, port: Number(PORT ?? 3000) }, (info) => console.log(`food-planner listening on :${info.port}`));

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () =>
    server.close(async () => {
      await database.close();
      process.exit(0);
    }),
  );
}
