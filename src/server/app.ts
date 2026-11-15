import { Hono } from "hono";
import { compress } from "hono/compress";
import { createAccessRoutes } from "./access.ts";
import { createChildRoutes } from "./children.ts";
import type { Database } from "./db.ts";
import { createPhotoRecipeRoutes, type PhotoRecipeClient } from "./photo-recipe.ts";
import { createRecipeRoutes } from "./recipes.ts";
import { createShoppingRoutes } from "./shopping.ts";
import { createWeekRoutes } from "./week.ts";

export type AppDependencies = {
  database: Database;
  now: () => Date;
  publicUrl: URL;
  photosDir: string;
  /** The built web app; the share page's HTML comes from here. */
  webDir: string;
  /** Reads recipe photos; undefined while ANTHROPIC_API_KEY is not set. */
  photoRecipeClient?: PhotoRecipeClient;
};

export function createApp(dependencies: AppDependencies) {
  const { database } = dependencies;
  const app = new Hono();
  // Gzip text responses (the scripts alone shrink to about a third); photos are skipped since JPEG doesn't shrink.
  app.use("*", compress());

  app.get("/api/health", async (c) => {
    const reachable = await database.isReachable();
    return c.json({ status: reachable ? "ok" : "degraded", database: reachable ? "ok" : "unreachable" }, reachable ? 200 : 503);
  });

  app.route("/", createAccessRoutes(dependencies));
  app.route("/", createRecipeRoutes(dependencies));
  app.route("/", createPhotoRecipeRoutes(dependencies));
  app.route("/", createWeekRoutes(dependencies));
  app.route("/", createChildRoutes(dependencies));
  app.route("/", createShoppingRoutes(dependencies));

  return app;
}
