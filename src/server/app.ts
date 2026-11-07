import { Hono } from "hono";
import { createAuthRoutes, type AuthDependencies } from "./auth.ts";

export type AppDependencies = AuthDependencies;

export function createApp(dependencies: AppDependencies) {
  const { database } = dependencies;
  const app = new Hono();

  app.get("/healthz", async (c) => {
    const reachable = await database.isReachable();
    return c.json({ status: reachable ? "ok" : "degraded", database: reachable ? "ok" : "unreachable" }, reachable ? 200 : 503);
  });

  app.route("/", createAuthRoutes(dependencies));

  return app;
}
