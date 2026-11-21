import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { isLanguage, isOrganic, type Profile, type ProfileChange } from "../shared/profile.ts";
import type { AppDependencies } from "./app.ts";
import { kitchenMember, type MemberEnv } from "./recipes.ts";
import { children, kitchens, users } from "./schema.ts";

type Body = Record<string, unknown>;
const readBody = async (request: { json(): Promise<unknown> }): Promise<Body> => {
  const body = await request.json().catch(() => undefined);
  return body && typeof body === "object" ? (body as Body) : {};
};

/** Your language, and the kitchen's shared settings: kids, and nemlig.com delivery. */
export function createProfileRoutes({ database, now }: AppDependencies) {
  const { db } = database;
  const routes = new Hono<MemberEnv>();
  const member = kitchenMember({ database, now });

  async function load(userId: string, kitchenId: string): Promise<Profile> {
    const [[user], [kitchen]] = await Promise.all([
      db.select({ language: users.language }).from(users).where(eq(users.id, userId)),
      db.select().from(kitchens).where(eq(kitchens.id, kitchenId)),
    ]);
    return {
      language: isLanguage(user!.language) ? user!.language : "en",
      kids: kitchen!.kids,
      nemlig: { on: kitchen!.nemligOn, day: kitchen!.nemligDay, organic: isOrganic(kitchen!.nemligOrganic) ? kitchen!.nemligOrganic : "none" },
    };
  }

  routes.get("/api/profile", member, async (c) => {
    const { userId, kitchenId } = c.get("member");
    return c.json(await load(userId, kitchenId));
  });

  routes.put("/api/profile", member, async (c) => {
    const { userId, kitchenId } = c.get("member");
    const body = (await readBody(c.req)) as ProfileChange & Body;
    if ("language" in body && !isLanguage(body.language)) return c.json({ error: "Pick English or Danish." }, 400);
    if ("kids" in body && typeof body.kids !== "boolean") return c.json({ error: "Say yes or no to children." }, 400);
    const nemlig = (body.nemlig ?? {}) as Body;
    if (typeof nemlig !== "object") return c.json({ error: "Send the nemlig.com settings." }, 400);
    if ("on" in nemlig && typeof nemlig.on !== "boolean") return c.json({ error: "Say yes or no to nemlig.com." }, 400);
    // A yes or no from an older app still works: yes is everything organic.
    if (typeof nemlig.organic === "boolean") nemlig.organic = nemlig.organic ? "all" : "none";
    if ("organic" in nemlig && !isOrganic(nemlig.organic)) return c.json({ error: "Pick none, fruit and veg, or everything for organic." }, 400);
    if ("day" in nemlig && !(Number.isInteger(nemlig.day) && (nemlig.day as number) >= 0 && (nemlig.day as number) <= 6)) return c.json({ error: "Pick a delivery day." }, 400);

    await db.transaction(async (tx) => {
      if (body.language) await tx.update(users).set({ language: body.language }).where(eq(users.id, userId));
      const kitchen = {
        ...(typeof body.kids === "boolean" ? { kids: body.kids } : {}),
        ...("on" in nemlig ? { nemligOn: nemlig.on as boolean } : {}),
        ...("day" in nemlig ? { nemligDay: nemlig.day as number } : {}),
        ...("organic" in nemlig ? { nemligOrganic: nemlig.organic as string } : {}),
      };
      if (Object.keys(kitchen).length) await tx.update(kitchens).set(kitchen).where(eq(kitchens.id, kitchenId));
      // A kitchen that now has kids but no child gets one to rename on the kids tab.
      if (body.kids === true) {
        await tx.execute(sql`insert into ${children} (kitchen_id, name)
          select ${kitchenId}, 'Baby' where not exists (select 1 from ${children} where kitchen_id = ${kitchenId})`);
      }
    });
    return c.json(await load(userId, kitchenId));
  });

  return routes;
}
