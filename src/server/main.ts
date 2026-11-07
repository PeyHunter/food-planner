import { access, constants, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createApp } from "./app.ts";
import { connectDatabase, migrate } from "./db.ts";
import { ensureHousehold } from "./household.ts";

type Config = {
  databaseUrl: string;
  port: number;
  publicUrl: URL;
  photosDir: string | undefined;
  peytonPassword: string;
  ronjaPassword: string;
};

function readConfig(env: NodeJS.ProcessEnv): Config | { error: string } {
  const production = env.NODE_ENV === "production";
  const { DATABASE_URL, PEYTON_PASSWORD, RONJA_PASSWORD } = env;
  if (!DATABASE_URL) return { error: "DATABASE_URL is not set." };
  if (!PEYTON_PASSWORD || !RONJA_PASSWORD) return { error: "PEYTON_PASSWORD and RONJA_PASSWORD must both be set. They are the starting passwords for the two logins." };
  const port = Number(env.PORT ?? 3000);
  const publicUrl = readPublicUrl(env, port);
  if ("error" in publicUrl) return publicUrl;
  const photosDir = env.PHOTOS_DIR || undefined;
  if (!photosDir && production) return { error: "PHOTOS_DIR is not set. Set it to a writable directory on a persistent volume." };
  return { databaseUrl: DATABASE_URL, port, publicUrl, photosDir, peytonPassword: PEYTON_PASSWORD, ronjaPassword: RONJA_PASSWORD };
}

function readPublicUrl(env: NodeJS.ProcessEnv, port: number): URL | { error: string } {
  if (!env.PUBLIC_URL) {
    if (env.NODE_ENV === "production") return { error: "PUBLIC_URL is not set. Set it to the address phones open, e.g. https://food-planner.peytonhunter.com." };
    return new URL(`http://localhost:${port}`);
  }
  const url = URL.parse(env.PUBLIC_URL);
  if (!url || (url.protocol !== "https:" && url.protocol !== "http:")) {
    return { error: `PUBLIC_URL must start with https:// or http:// (got "${env.PUBLIC_URL}").` };
  }
  if (env.NODE_ENV === "production" && url.protocol !== "https:") {
    return { error: `In production PUBLIC_URL must start with https://, so the login cookie is only sent encrypted (got "${env.PUBLIC_URL}").` };
  }
  return new URL(url.origin);
}

const config = readConfig(process.env);
if ("error" in config) {
  console.error(`food-planner cannot start: ${config.error}`);
  process.exit(1);
}

const photosDir = config.photosDir ?? (await mkdtemp(join(tmpdir(), "food-planner-photos-")));
if (!config.photosDir) console.log(`PHOTOS_DIR is not set: keeping photos in ${photosDir} until the app stops.`);
const writable = await mkdir(photosDir, { recursive: true })
  .then(() => access(photosDir, constants.W_OK))
  .then(
    () => true,
    () => false,
  );
if (!writable) {
  console.error(`food-planner cannot start: PHOTOS_DIR (${photosDir}) is not a directory the app can write to.`);
  process.exit(1);
}

const database = connectDatabase(config.databaseUrl);
await migrate(database);
await ensureHousehold(database, [
  { username: "peyton", password: config.peytonPassword },
  { username: "ronja", password: config.ronjaPassword },
]);

const app = createApp({ database, now: () => new Date(), publicUrl: config.publicUrl, photosDir });
// The built phone UI; any path the API doesn't own falls back to the single page.
app.use("*", serveStatic({ root: "dist/web" }));
app.get("*", serveStatic({ path: "dist/web/index.html" }));

const server = serve({ fetch: app.fetch, port: config.port }, (info) => console.log(`food-planner listening on :${info.port}`));

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () =>
    server.close(async () => {
      await database.close();
      if (!config.photosDir) await rm(photosDir, { recursive: true, force: true });
      process.exit(0);
    }),
  );
}
