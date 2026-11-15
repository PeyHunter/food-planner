import { Hono } from "hono";
import { createAccessRoutes } from "./access.ts";
import { createChildRoutes } from "./children.ts";
import type { Database } from "./db.ts";
import { createRecipeRoutes } from "./recipes.ts";
import { createShoppingRoutes } from "./shopping.ts";
import { createWeekRoutes } from "./week.ts";

export type AppDependencies = {
  database: Database;
  now: () => Date;
  publicUrl: URL;
  photosDir: string;
};

export function createApp(dependencies: AppDependencies) {
  const { database } = dependencies;
  const app = new Hono();

  app.get("/api/health", async (c) => {
    const reachable = await database.isReachable();
    return c.json({ status: reachable ? "ok" : "degraded", database: reachable ? "ok" : "unreachable" }, reachable ? 200 : 503);
  });

  app.route("/", createAccessRoutes(dependencies));
  app.route("/", createRecipeRoutes(dependencies));
  app.route("/", createWeekRoutes(dependencies));
  app.route("/", createChildRoutes(dependencies));
  app.route("/", createShoppingRoutes(dependencies));

  return app;
}
