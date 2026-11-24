import { access, constants, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import type { Context } from "hono";
import Anthropic from "@anthropic-ai/sdk";
import { createApp } from "./app.ts";
import { connectDatabase, migrate } from "./db.ts";
import { ensureHousehold } from "./household.ts";
import { readKitchens, type ReadyKitchen } from "./kitchens-config.ts";
import { photoStore, shrinkOldPhotos } from "./photos.ts";
import { applyCatalogPacks, reguessOtherShopSections } from "./recipes.ts";
import { readSecretKey, secretStore } from "./secrets.ts";
import { fakeClient, type PhotoRecipeClient } from "./photo-recipe.ts";
import { addStarterRecipesOnce } from "./starter-recipes.ts";

type Config = {
  databaseUrl: string;
  port: number;
  publicUrl: URL;
  photosDir: string | undefined;
  /** Kitchens whose passwords are all set (see kitchenConfigs in kitchens-config.ts). */
  kitchens: ReadyKitchen[];
};

function readConfig(env: NodeJS.ProcessEnv): Config | { error: string } {
  const production = env.NODE_ENV === "production";
  const { DATABASE_URL } = env;
  if (!DATABASE_URL) return { error: "DATABASE_URL is not set." };
  const kitchens = readKitchens(env);
  if ("error" in kitchens) return kitchens;
  const port = Number(env.PORT ?? 3000);
  const publicUrl = readPublicUrl(env, port);
  if ("error" in publicUrl) return publicUrl;
  const photosDir = env.PHOTOS_DIR || undefined;
  if (!photosDir && production) return { error: "PHOTOS_DIR is not set. Set it to a writable directory on a persistent volume." };
  return {
    databaseUrl: DATABASE_URL,
    port,
    publicUrl,
    photosDir,
    kitchens,
  };
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

/** The real API client when the key is set; PHOTO_RECIPE_FAKE (browser tests, never in production) gives a fake that always reads the same recipe. */
function photoRecipeClient(env: NodeJS.ProcessEnv): PhotoRecipeClient | undefined {
  if (env.PHOTO_RECIPE_FAKE === "1" && env.NODE_ENV !== "production") {
    return fakeClient({
      title: "Granny's pancakes",
      description: "Thin pancakes like Granny made on Sundays.",
      feeds: 4,
      minutes: 30,
      mainTypes: ["Vegetarian"],
      tags: ["quick"],
      lines: [
        { amount: 2, unit: "cups", ingredient: "Milk", note: "" },
        { amount: 3, unit: "pcs", ingredient: "Egg", note: "" },
        { amount: 1, unit: "pinch", ingredient: "Salt", note: "" },
        { amount: -1, unit: "g", ingredient: "Butter", note: "" },
      ],
      steps: ["Whisk everything together.", "Fry thin pancakes in butter."],
      dishPhoto: { photo: 1, left: 0.1, top: 0.05, right: 0.9, bottom: 0.45 },
    });
  }
  if (!env.ANTHROPIC_API_KEY) return undefined;
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
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
for (const { people, starter, extras, ...kitchen } of config.kitchens) {
  const kitchenId = await ensureHousehold(database, people, kitchen);
  if (starter) await addStarterRecipesOnce(database, kitchenId, kitchen.language, extras);
}
await reguessOtherShopSections(database);
await applyCatalogPacks(database);

// Without the key the app runs; only the features that keep a sealed login (nemlig.com) stay off.
const secretKey = readSecretKey(process.env.APP_SECRET_KEY);
if (!Buffer.isBuffer(secretKey)) console.log(`${secretKey.error} The nemlig.com login stays off until it is set.`);
const secrets = Buffer.isBuffer(secretKey) ? secretStore(database, () => new Date(), secretKey) : undefined;

const app = createApp({ database, now: () => new Date(), publicUrl: config.publicUrl, photosDir, webDir: "dist/web", photoRecipeClient: photoRecipeClient(process.env), secrets });
// The built phone UI; any path the API doesn't own falls back to the single page.
// Built files carry a hash in their name, so they never change; the page and the service worker must be asked for
// again each time, or a phone keeps showing last week's app after an update.
const cacheRules = (path: string, c: Context) =>
  c.header("cache-control", /\/assets\//.test(path) ? "public, max-age=31536000, immutable" : "no-cache");
app.use("*", serveStatic({ root: "dist/web", onFound: cacheRules }));
app.get("*", serveStatic({ path: "dist/web/index.html", onFound: cacheRules }));

// Photos saved before the size limits came down are made smaller, one at a time, in the background.
void shrinkOldPhotos(database, photoStore(photosDir)).catch((error: unknown) => console.error("Shrinking old photos stopped:", error));

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
