import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { fitsAge, monthsOld } from "../shared/child-age.ts";
import type { ChildInput, ChildRecipe, ChildRecipes, ChildView } from "../shared/children.ts";
import { childRecipeTag, isDate } from "../shared/week.ts";
import type { AppDependencies } from "./app.ts";
import { kitchenMember, recipeSummaries, type MemberEnv } from "./recipes.ts";
import { children, recipes } from "./schema.ts";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function parseChild(body: unknown, today: string): ChildInput | { error: string } {
  const raw = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name || name.length > 60) return { error: "Give the child a name." };
  const birthday = raw.birthday === null || raw.birthday === undefined || raw.birthday === "" ? null : raw.birthday;
  if (birthday !== null && (typeof birthday !== "string" || !isDate(birthday))) return { error: "Pick a birthday." };
  if (birthday !== null && birthday > today) return { error: "The birthday can't be in the future." };
  const byDefault = raw.sameAsDinnerByDefault;
  if (byDefault !== undefined && typeof byDefault !== "boolean") return { error: "Say yes or no to same as dinner." };
  return byDefault === undefined ? { name, birthday } : { name, birthday, sameAsDinnerByDefault: byDefault };
}

export function createChildRoutes({ database, now }: AppDependencies) {
  const { db } = database;
  const routes = new Hono<MemberEnv>();
  const member = kitchenMember({ database, now });
  // The phone sends its own date, so the age is right just after midnight in its time zone.
  const todayFrom = (value: string | undefined) => (value && isDate(value) ? value : now().toISOString().slice(0, 10));
  // A phone a day ahead of the server may set today's birthday.
  const latestBirthday = () => new Date(now().getTime() + 86_400_000).toISOString().slice(0, 10);

  const listChildren = (kitchenId: string) =>
    db
      .select({ id: children.id, name: children.name, birthday: children.birthday, sameAsDinnerByDefault: children.sameAsDinnerByDefault })
      .from(children)
      .where(eq(children.kitchenId, kitchenId))
      .orderBy(asc(children.createdAt), asc(children.id));

  async function ownChild(kitchenId: string, id: string) {
    if (!uuidPattern.test(id)) return undefined;
    const [row] = await db
      .select({ id: children.id, name: children.name, birthday: children.birthday })
      .from(children)
      .where(and(eq(children.id, id), eq(children.kitchenId, kitchenId)));
    return row;
  }

  routes.get("/api/children", member, async (c) => {
    const today = todayFrom(c.req.query("today"));
    const kids = await listChildren(c.get("member").kitchenId);
    return c.json(kids.map((kid): ChildView => ({ ...kid, ageMonths: kid.birthday ? monthsOld(kid.birthday, today) : null })));
  });

  routes.post("/api/children", member, async (c) => {
    if (!c.get("member").kids) return c.json({ error: "This kitchen has no children." }, 403);
    const input = parseChild(await c.req.json().catch(() => undefined), latestBirthday());
    if ("error" in input) return c.json(input, 400);
    const [row] = await db
      .insert(children)
      .values({ kitchenId: c.get("member").kitchenId, ...input })
      .returning({ id: children.id });
    return c.json({ id: row!.id }, 201);
  });

  routes.put("/api/children/:id", member, async (c) => {
    const { kitchenId } = c.get("member");
    if (!(await ownChild(kitchenId, c.req.param("id")))) return c.json({ error: "No such child." }, 404);
    const input = parseChild(await c.req.json().catch(() => undefined), latestBirthday());
    if ("error" in input) return c.json(input, 400);
    await db.update(children).set(input).where(eq(children.id, c.req.param("id")));
    return c.json({ id: c.req.param("id") });
  });

  routes.delete("/api/children/:id", member, async (c) => {
    const { kitchenId } = c.get("member");
    if (!(await ownChild(kitchenId, c.req.param("id")))) return c.json({ error: "No such child." }, 404);
    // Startup gives a kitchen with no children Runi Lee again, so the last one stays.
    if ((await listChildren(kitchenId)).length === 1) return c.json({ error: "Keep at least one child." }, 409);
    await db.delete(children).where(eq(children.id, c.req.param("id")));
    return c.body(null, 204);
  });

  routes.get("/api/children/:id/recipes", member, async (c) => {
    const { kitchenId } = c.get("member");
    const kid = await ownChild(kitchenId, c.req.param("id"));
    if (!kid) return c.json({ error: "No such child." }, 404);
    const rows = await db
      .select({ id: recipes.id, title: recipes.title, feeds: recipes.feeds, ageFromMonths: recipes.ageFromMonths, ageToMonths: recipes.ageToMonths })
      .from(recipes)
      .where(eq(recipes.kitchenId, kitchenId));
    const ranges = new Map(rows.map((row) => [row.id, row]));
    const summaries = await recipeSummaries(
      database,
      rows.map(({ id, title, feeds }) => ({ id, title, feeds })),
    );
    const all = summaries
      .map((summary): ChildRecipe => ({ ...summary, ageFromMonths: ranges.get(summary.id)!.ageFromMonths, ageToMonths: ranges.get(summary.id)!.ageToMonths }))
      .sort((a, b) => a.title.localeCompare(b.title));
    const age = kid.birthday ? monthsOld(kid.birthday, todayFrom(c.req.query("today"))) : null;
    const hasRange = (recipe: ChildRecipe) => recipe.ageFromMonths !== null || recipe.ageToMonths !== null;
    // Her recipes come first. One with an age range only shows while it fits her; without a birthday we can't tell, so it shows.
    const hers = all.filter((recipe) => recipe.tags.includes(childRecipeTag) && (age === null || !hasRange(recipe) || fitsAge(recipe, age)));
    const others = age === null ? [] : all.filter((recipe) => !recipe.tags.includes(childRecipeTag) && fitsAge(recipe, age));
    const result: ChildRecipes = { hers, fitsAge: others };
    return c.json(result);
  });

  return routes;
}
