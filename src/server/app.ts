import { Hono } from "hono";
import { compress } from "hono/compress";
import { secureHeaders } from "hono/secure-headers";
import { createAccessRoutes } from "./access.ts";
import { createChildRoutes } from "./children.ts";
import type { Database } from "./db.ts";
import { createFreezerRoutes } from "./freezer.ts";
import { createProfileRoutes } from "./profile.ts";
import { createPhotoRecipeRoutes, type PhotoRecipeClient } from "./photo-recipe.ts";
import { createRecipeRoutes } from "./recipes.ts";
import type { SecretStore } from "./secrets.ts";
import { createSecurityRoutes, isAllowedOrigin } from "./security.ts";
import { createShoppingRoutes } from "./shopping.ts";
import { createStarterRoutes } from "./starter-recipes.ts";
import { createVeggieRecipeRoutes } from "./veggie-recipe.ts";
import type { OpenUrl } from "./link-recipe.ts";
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
  /** Opens recipe links; only tests pass their own. */
  openUrl?: OpenUrl;
  /** Sealed per-person secrets (nemlig.com login); undefined while APP_SECRET_KEY is not set, and the nemlig.com login stays off. */
  secrets?: SecretStore;
};

export function createApp(dependencies: AppDependencies) {
  const { database, publicUrl } = dependencies;
  const app = new Hono();
  app.use(
    "*",
    secureHeaders({
      // blob: is the photo previews made in the browser; data: is small inline images.
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        // Safari's own <select> carries an inline style attribute; without this every dropdown logs a refused style.
        // Only style="" attributes are allowed: <style> tags and outside stylesheets stay blocked.
        styleSrcAttr: ["'unsafe-inline'"],
        imgSrc: ["'self'", "blob:", "data:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        manifestSrc: ["'self'"],
        workerSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
      referrerPolicy: "same-origin",
      xFrameOptions: "DENY",
    }),
  );
  // The session cookie is SameSite=Lax, so other sites can't send it with a POST. As a second lock, a change sent
  // from a page on another site is refused. Requests without an Origin (curl, tests) carry no browser cookie risk.
  app.use("/api/*", async (c, next) => {
    const origin = c.req.header("origin");
    const changes = !["GET", "HEAD", "OPTIONS"].includes(c.req.method);
    if (changes && origin && !isAllowedOrigin(origin, publicUrl)) return c.json({ error: "That request came from another site." }, 403);
    await next();
  });
  // Gzip text responses (the scripts alone shrink to about a third); photos are skipped since JPEG doesn't shrink.
  app.use("*", compress());

  app.get("/api/health", async (c) => {
    const reachable = await database.isReachable();
    return c.json({ status: reachable ? "ok" : "degraded", database: reachable ? "ok" : "unreachable" }, reachable ? 200 : 503);
  });

  app.route("/", createAccessRoutes(dependencies));
  app.route("/", createSecurityRoutes(dependencies));
  app.route("/", createStarterRoutes(dependencies));
  app.route("/", createRecipeRoutes(dependencies));
  app.route("/", createPhotoRecipeRoutes(dependencies));
  app.route("/", createVeggieRecipeRoutes(dependencies));
  app.route("/", createWeekRoutes(dependencies));
  app.route("/", createChildRoutes(dependencies));
  app.route("/", createShoppingRoutes(dependencies));
  app.route("/", createFreezerRoutes(dependencies));
  app.route("/", createProfileRoutes(dependencies));

  return app;
}
