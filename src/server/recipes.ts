import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { createMiddleware } from "hono/factory";
import { mainTypes, type Cook, type IngredientSuggestion, type MainType, type Photo, type Recipe, type RecipeInput, type RecipeSummary, type ShareLink, type SharedRecipe, type ShopSection } from "../shared/recipes.ts";
import { isUnit } from "../shared/units.ts";
import { sessionUser } from "./access.ts";
import type { AppDependencies } from "./app.ts";
import { photoStore, type StoredPhoto } from "./photos.ts";
import { cooks, ingredients, kitchenMembers, photos, recipeLines, recipes, recipeTags, recipeTypes, steps, users } from "./schema.ts";

type Member = { userId: string; kitchenId: string };
type Env = { Variables: { member: Member } };

const megabyte = 1024 * 1024;
const maxCookPhotos = 6;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const tooBig = (c: Context) => c.json({ error: "That photo is too big. Try a smaller one." }, 413);
const unreadable = "That file isn't a photo we can read. Try a JPEG or PNG.";

const photoUrl = (id: string) => `/api/photos/${id}.jpg`;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const toPhoto = (row: { id: string; role: string; cookId: string | null }): Photo => ({
  id: row.id,
  url: photoUrl(row.id),
  role: row.role === "main" ? "main" : "gallery",
  cookId: row.cookId,
});
// LIKE treats % and _ as wildcards; a search for "50%" means the text.
const likeText = (text: string) => `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

export function createRecipeRoutes({ database, now, photosDir, publicUrl }: AppDependencies) {
  const { db } = database;
  const store = photoStore(photosDir);
  const routes = new Hono<Env>();

  const member = createMiddleware<Env>(async (c, next) => {
    const user = await sessionUser(database, now, c);
    if (!user) return c.json({ error: "Not logged in" }, 401);
    const [row] = await db.select({ kitchenId: kitchenMembers.kitchenId }).from(kitchenMembers).where(eq(kitchenMembers.userId, user.id)).limit(1);
    if (!row) return c.json({ error: "You are not in a kitchen yet." }, 403);
    c.set("member", { userId: user.id, kitchenId: row.kitchenId });
    await next();
  });

  /** The recipe's id when it exists in the caller's kitchen. */
  async function ownRecipe(c: Context<Env>) {
    const id = c.req.param("id") ?? "";
    if (!uuidPattern.test(id)) return undefined;
    const [row] = await db
      .select({ id: recipes.id })
      .from(recipes)
      .where(and(eq(recipes.id, id), eq(recipes.kitchenId, c.get("member").kitchenId)));
    return row?.id;
  }

  routes.get("/api/recipes", member, async (c) => {
    const { kitchenId } = c.get("member");
    const q = (c.req.query("q") ?? "").trim();
    const matches = q
      ? sql`(${recipes.title} ilike ${likeText(q)} or exists (
          select 1 from ${recipeLines} join ${ingredients} on ${ingredients.id} = ${recipeLines.ingredientId}
          where ${recipeLines.recipeId} = ${recipes.id} and ${ingredients.name} ilike ${likeText(q)}))`
      : undefined;
    const rows = await db
      .select({ id: recipes.id, title: recipes.title, feeds: recipes.feeds })
      .from(recipes)
      .where(and(eq(recipes.kitchenId, kitchenId), matches))
      .orderBy(asc(sql`lower(${recipes.title})`));
    return c.json(await summaries(rows));
  });

  routes.get("/api/recipes/:id", member, async (c) => {
    const id = await ownRecipe(c);
    if (!id) return c.json({ error: "No such recipe." }, 404);
    return c.json(await loadRecipe(id));
  });

  routes.post("/api/recipes", member, async (c) => {
    const input = parseInput(await c.req.json().catch(() => undefined));
    if ("error" in input) return c.json(input, 400);
    const { kitchenId, userId } = c.get("member");
    const id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(recipes)
        .values({ kitchenId, createdBy: userId, ...recipeColumns(input) })
        .returning({ id: recipes.id });
      await writeParts(tx, row!.id, kitchenId, userId, input);
      return row!.id;
    });
    return c.json({ id }, 201);
  });

  routes.put("/api/recipes/:id", member, async (c) => {
    const id = await ownRecipe(c);
    if (!id) return c.json({ error: "No such recipe." }, 404);
    const input = parseInput(await c.req.json().catch(() => undefined));
    if ("error" in input) return c.json(input, 400);
    const { kitchenId, userId } = c.get("member");
    await db.transaction(async (tx) => {
      await tx
        .update(recipes)
        .set({ ...recipeColumns(input), updatedAt: now() })
        .where(eq(recipes.id, id));
      for (const table of [recipeTypes, recipeTags, recipeLines, steps]) await tx.delete(table).where(eq(table.recipeId, id));
      await writeParts(tx, id, kitchenId, userId, input);
    });
    return c.json({ id });
  });

  routes.delete("/api/recipes/:id", member, async (c) => {
    const id = await ownRecipe(c);
    if (!id) return c.json({ error: "No such recipe." }, 404);
    const gone = await db.select({ id: photos.id }).from(photos).where(eq(photos.recipeId, id));
    await db.delete(recipes).where(eq(recipes.id, id));
    await Promise.all(gone.map((photo) => store.remove(photo.id)));
    return c.body(null, 204);
  });

  routes.get("/api/ingredients", member, async (c) => {
    const q = (c.req.query("q") ?? "").trim();
    if (!q) return c.json([]);
    const rows = await db
      .select({ id: ingredients.id, name: ingredients.name, shopSection: ingredients.shopSection })
      .from(ingredients)
      .where(and(eq(ingredients.kitchenId, c.get("member").kitchenId), sql`${ingredients.name} ilike ${likeText(q)}`))
      // Names that start with what was typed come first.
      .orderBy(sql`${ingredients.name} ilike ${likeText(q).slice(1)} desc`, asc(sql`lower(${ingredients.name})`))
      .limit(8);
    return c.json(rows as IngredientSuggestion[]);
  });

  routes.post("/api/recipes/:id/photos", member, bodyLimit({ maxSize: 25 * megabyte, onError: tooBig }), async (c) => {
    const recipeId = await ownRecipe(c);
    if (!recipeId) return c.json({ error: "No such recipe." }, 404);
    const body = await c.req.parseBody();
    if (!(body.photo instanceof File)) return c.json({ error: "Pick a photo first." }, 400);
    const role = body.role === "main" ? "main" : "gallery";
    const saved = await savePhoto(body.photo);
    if (!saved) return c.json({ error: unreadable }, 400);
    const replaced = await db.transaction(async (tx) => {
      const old = role === "main" ? await tx.delete(photos).where(and(eq(photos.recipeId, recipeId), eq(photos.role, "main"))).returning({ id: photos.id }) : [];
      await tx.insert(photos).values({ ...saved, recipeId, role, createdBy: c.get("member").userId });
      return old;
    });
    await Promise.all(replaced.map((photo) => store.remove(photo.id)));
    return c.json(toPhoto({ id: saved.id, role, cookId: null }), 201);
  });

  routes.delete("/api/photos/:id", member, async (c) => {
    const id = c.req.param("id");
    if (!store.isPhotoId(id)) return c.json({ error: "No such photo." }, 404);
    const [row] = await db
      .delete(photos)
      .where(and(eq(photos.id, id), inArray(photos.recipeId, db.select({ id: recipes.id }).from(recipes).where(eq(recipes.kitchenId, c.get("member").kitchenId)))))
      .returning({ id: photos.id });
    if (!row) return c.json({ error: "No such photo." }, 404);
    await store.remove(id);
    return c.body(null, 204);
  });

  routes.get("/api/photos/:file", member, async (c) => {
    const id = c.req.param("file").replace(/\.jpg$/, "");
    if (!store.isPhotoId(id)) return c.json({ error: "No such photo." }, 404);
    const [row] = await db
      .select({ id: photos.id })
      .from(photos)
      .innerJoin(recipes, eq(recipes.id, photos.recipeId))
      .where(and(eq(photos.id, id), eq(recipes.kitchenId, c.get("member").kitchenId)));
    if (!row) return c.json({ error: "No such photo." }, 404);
    const file = await store.read(id).catch(() => undefined);
    if (!file) return c.json({ error: "No such photo." }, 404);
    // A photo id never gets new content, so phones can keep it for a year.
    return c.body(new Uint8Array(file), 200, { "content-type": "image/jpeg", "cache-control": "private, max-age=31536000, immutable" });
  });

  const shareLink = (token: string | null): ShareLink => ({ url: token ? new URL(`/s/${token}`, publicUrl).href : null });

  routes.get("/api/recipes/:id/share", member, async (c) => {
    const id = await ownRecipe(c);
    if (!id) return c.json({ error: "No such recipe." }, 404);
    const [row] = await db.select({ token: recipes.shareToken }).from(recipes).where(eq(recipes.id, id));
    return c.json(shareLink(row!.token));
  });

  routes.post("/api/recipes/:id/share", member, async (c) => {
    const id = await ownRecipe(c);
    if (!id) return c.json({ error: "No such recipe." }, 404);
    // Keeps the token when sharing is already on, so links sent earlier keep working.
    const [row] = await db
      .update(recipes)
      .set({ shareToken: sql`coalesce(${recipes.shareToken}, ${randomBytes(32).toString("base64url")})` })
      .where(eq(recipes.id, id))
      .returning({ token: recipes.shareToken });
    return c.json(shareLink(row!.token));
  });

  routes.delete("/api/recipes/:id/share", member, async (c) => {
    const id = await ownRecipe(c);
    if (!id) return c.json({ error: "No such recipe." }, 404);
    await db.update(recipes).set({ shareToken: null }).where(eq(recipes.id, id));
    return c.json(shareLink(null));
  });

  /** The recipe's id while its share link is on. */
  async function sharedRecipe(token: string) {
    if (!tokenPattern.test(token)) return undefined;
    const [row] = await db.select({ id: recipes.id }).from(recipes).where(eq(recipes.shareToken, token));
    return row?.id;
  }

  routes.get("/api/share/:token", async (c) => {
    const token = c.req.param("token");
    const id = await sharedRecipe(token);
    if (!id) return c.json({ error: "This link doesn't work any more." }, 404, { "cache-control": "no-store" });
    const { title, feeds, types, tags, mainPhoto, photos: all, lines, steps: stepTexts } = await loadRecipe(id);
    const viaLink = (photo: Photo): Photo => ({ ...photo, url: `/s/${token}/photos/${photo.id}.jpg` });
    const shared: SharedRecipe = { title, feeds, types, tags, mainPhoto: mainPhoto && viaLink(mainPhoto), photos: all.map(viaLink), lines, steps: stepTexts };
    return c.json(shared, 200, { "cache-control": "no-store" });
  });

  routes.get("/s/:token/photos/:file", async (c) => {
    const id = c.req.param("file").replace(/\.jpg$/, "");
    const recipeId = await sharedRecipe(c.req.param("token"));
    if (!recipeId || !store.isPhotoId(id)) return c.text("No such photo.", 404);
    const [row] = await db
      .select({ id: photos.id })
      .from(photos)
      .where(and(eq(photos.id, id), eq(photos.recipeId, recipeId)));
    const file = row && (await store.read(id).catch(() => undefined));
    if (!file) return c.text("No such photo.", 404);
    // Short, so a phone stops showing it soon after the link is turned off.
    return c.body(new Uint8Array(file), 200, { "content-type": "image/jpeg", "cache-control": "private, max-age=600" });
  });

  // The page itself is the web app's index.html, served after this; a dead link gets that same page with a 404.
  routes.get("/s/:token", async (c, next) => {
    const live = await sharedRecipe(c.req.param("token"));
    await next();
    if (!live) c.res = new Response(c.res.body, { status: 404, headers: c.res.headers });
  });

  routes.post("/api/recipes/:id/cooks", member, bodyLimit({ maxSize: 60 * megabyte, onError: tooBig }), async (c) => {
    const recipeId = await ownRecipe(c);
    if (!recipeId) return c.json({ error: "No such recipe." }, 404);
    const body = await c.req.parseBody({ all: true });
    const madeOn = typeof body.madeOn === "string" && body.madeOn ? body.madeOn : now().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(madeOn) || Number.isNaN(Date.parse(madeOn))) return c.json({ error: "Pick a date." }, 400);
    const files = [body.photos ?? []].flat().filter((value): value is File => value instanceof File && value.size > 0);
    if (files.length > maxCookPhotos) return c.json({ error: `Add at most ${maxCookPhotos} photos at once.` }, 400);
    const saved: StoredPhoto[] = [];
    for (const file of files) {
      const photo = await savePhoto(file);
      if (!photo) {
        await Promise.all(saved.map((done) => store.remove(done.id)));
        return c.json({ error: unreadable }, 400);
      }
      saved.push(photo);
    }
    const { userId } = c.get("member");
    const cookId = await db.transaction(async (tx) => {
      const [cook] = await tx.insert(cooks).values({ recipeId, madeOn, createdBy: userId }).returning({ id: cooks.id });
      if (saved.length) await tx.insert(photos).values(saved.map((photo) => ({ ...photo, recipeId, cookId: cook!.id, role: "gallery", createdBy: userId })));
      return cook!.id;
    });
    return c.json({ id: cookId, madeOn, photos: saved.map((photo) => toPhoto({ id: photo.id, role: "gallery", cookId })) }, 201);
  });

  async function savePhoto(file: File) {
    try {
      return await store.save(new Uint8Array(await file.arrayBuffer()));
    } catch {
      return undefined;
    }
  }

  type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

  async function writeParts(tx: Tx, recipeId: string, kitchenId: string, userId: string, input: RecipeInput) {
    if (input.types.length) await tx.insert(recipeTypes).values(input.types.map((type) => ({ recipeId, type })));
    if (input.tags.length) await tx.insert(recipeTags).values(input.tags.map((tag) => ({ recipeId, tag })));
    if (input.steps.length) await tx.insert(steps).values(input.steps.map((text, position) => ({ recipeId, position, text })));
    if (!input.lines.length) return;
    const names = [...new Map(input.lines.map((line) => [line.ingredient.toLowerCase(), line.ingredient])).values()];
    // New names join the kitchen's list; existing ones (any capitalisation) are reused.
    await tx
      .insert(ingredients)
      .values(names.map((name) => ({ kitchenId, name, createdBy: userId })))
      .onConflictDoNothing();
    const known = await tx
      .select({ id: ingredients.id, name: ingredients.name })
      .from(ingredients)
      .where(
        and(
          eq(ingredients.kitchenId, kitchenId),
          inArray(
            sql`lower(${ingredients.name})`,
            names.map((name) => name.toLowerCase()),
          ),
        ),
      );
    const idOf = new Map(known.map((row) => [row.name.toLowerCase(), row.id]));
    await tx.insert(recipeLines).values(
      input.lines.map((line, position) => ({
        recipeId,
        position,
        amount: line.amount,
        unit: line.unit,
        ingredientId: idOf.get(line.ingredient.toLowerCase())!,
        note: line.note,
      })),
    );
  }

  async function summaries(rows: { id: string; title: string; feeds: number }[]): Promise<RecipeSummary[]> {
    if (!rows.length) return [];
    const ids = rows.map((row) => row.id);
    const [types, tags, mains, lastCooks] = await Promise.all([
      db.select().from(recipeTypes).where(inArray(recipeTypes.recipeId, ids)),
      db.select().from(recipeTags).where(inArray(recipeTags.recipeId, ids)).orderBy(asc(recipeTags.tag)),
      db
        .select({ id: photos.id, recipeId: photos.recipeId, role: photos.role, cookId: photos.cookId })
        .from(photos)
        .where(and(inArray(photos.recipeId, ids), eq(photos.role, "main"))),
      db
        .select({ recipeId: cooks.recipeId, last: sql<string>`max(${cooks.madeOn})::text` })
        .from(cooks)
        .where(inArray(cooks.recipeId, ids))
        .groupBy(cooks.recipeId),
    ]);
    return rows.map((row) => ({
      ...row,
      types: sortTypes(types.filter((type) => type.recipeId === row.id).map((type) => type.type)),
      tags: tags.filter((tag) => tag.recipeId === row.id).map((tag) => tag.tag),
      mainPhoto: (() => {
        const main = mains.find((photo) => photo.recipeId === row.id);
        return main ? toPhoto(main) : null;
      })(),
      lastMadeOn: lastCooks.find((cook) => cook.recipeId === row.id)?.last ?? null,
    }));
  }

  async function loadRecipe(id: string): Promise<Recipe> {
    const [row] = await db
      .select({
        id: recipes.id,
        title: recipes.title,
        feeds: recipes.feeds,
        ageFromMonths: recipes.ageFromMonths,
        ageToMonths: recipes.ageToMonths,
        createdBy: sql<string>`coalesce(${users.username}, '')`,
      })
      .from(recipes)
      .leftJoin(users, eq(users.id, recipes.createdBy))
      .where(eq(recipes.id, id));
    const { createdBy, ageFromMonths, ageToMonths, ...summaryRow } = row!;
    const [[summary], lines, stepRows, photoRows, cookRows] = await Promise.all([
      summaries([summaryRow]),
      db
        .select({
          amount: recipeLines.amount,
          unit: recipeLines.unit,
          note: recipeLines.note,
          ingredient: { id: ingredients.id, name: ingredients.name, shopSection: ingredients.shopSection },
        })
        .from(recipeLines)
        .innerJoin(ingredients, eq(ingredients.id, recipeLines.ingredientId))
        .where(eq(recipeLines.recipeId, id))
        .orderBy(asc(recipeLines.position)),
      db.select({ text: steps.text }).from(steps).where(eq(steps.recipeId, id)).orderBy(asc(steps.position)),
      db
        .select({ id: photos.id, role: photos.role, cookId: photos.cookId })
        .from(photos)
        .where(eq(photos.recipeId, id))
        .orderBy(asc(photos.createdAt), asc(photos.id)),
      db
        .select({ id: cooks.id, madeOn: cooks.madeOn, by: sql<string>`coalesce(${users.username}, '')` })
        .from(cooks)
        .leftJoin(users, eq(users.id, cooks.createdBy))
        .where(eq(cooks.recipeId, id))
        .orderBy(desc(cooks.madeOn), desc(cooks.createdAt)),
    ]);
    const allPhotos = photoRows.map(toPhoto);
    return {
      ...summary!,
      ageFromMonths,
      ageToMonths,
      createdBy,
      lines: lines.map((line) => ({
        ...line,
        unit: isUnit(line.unit) ? line.unit : null,
        ingredient: { ...line.ingredient, shopSection: line.ingredient.shopSection as ShopSection },
      })),
      steps: stepRows.map((step) => step.text),
      photos: allPhotos,
      cooks: cookRows.map((cook): Cook => ({ ...cook, photos: allPhotos.filter((photo) => photo.cookId === cook.id) })),
    };
  }

  return routes;
}

const sortTypes = (types: string[]) => mainTypes.filter((type) => types.includes(type));

function recipeColumns(input: RecipeInput) {
  return { title: input.title, feeds: input.feeds, ageFromMonths: input.ageFromMonths, ageToMonths: input.ageToMonths };
}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const list = (value: unknown) => (Array.isArray(value) ? (value as unknown[]) : []);

function months(value: unknown): number | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 240 ? (value as number) : undefined;
}

export function parseInput(body: unknown): RecipeInput | { error: string } {
  if (!body || typeof body !== "object") return { error: "Send the recipe as JSON." };
  const raw = body as Record<string, unknown>;
  const title = text(raw.title);
  if (!title) return { error: "Give the recipe a name." };
  if (title.length > 200) return { error: "That name is too long." };
  const feeds = raw.feeds;
  if (!Number.isInteger(feeds) || (feeds as number) < 1 || (feeds as number) > 100) return { error: "Feeds must be a whole number from 1 to 100." };
  const types = sortTypes(list(raw.types).filter((type): type is MainType => mainTypes.includes(type as MainType)));
  if (!types.length) return { error: "Pick at least one main type." };
  const tags = [...new Set(list(raw.tags).map(text).filter(Boolean))];
  if (tags.some((tag) => tag.length > 40)) return { error: "Keep each tag short." };
  const ageFromMonths = months(raw.ageFromMonths);
  const ageToMonths = months(raw.ageToMonths);
  if (ageFromMonths === undefined || ageToMonths === undefined) return { error: "Age must be a whole number of months." };
  if (ageFromMonths !== null && ageToMonths !== null && ageFromMonths > ageToMonths) return { error: "The age range goes from the lower age to the higher one." };
  const lines: RecipeInput["lines"] = [];
  for (const value of list(raw.lines)) {
    const line = (value ?? {}) as Record<string, unknown>;
    const ingredient = text(line.ingredient);
    if (!ingredient) return { error: "Every ingredient line needs an ingredient." };
    if (ingredient.length > 80) return { error: "That ingredient name is too long." };
    const amount = line.amount === null || line.amount === undefined || line.amount === "" ? null : line.amount;
    if (amount !== null && !(typeof amount === "number" && Number.isFinite(amount) && amount > 0)) return { error: `The amount for ${ingredient} must be a number above 0.` };
    const unit = line.unit === null || line.unit === undefined || line.unit === "" ? null : line.unit;
    if (unit !== null && !isUnit(unit)) return { error: `Pick a unit for ${ingredient}.` };
    if (amount !== null && unit === null) return { error: `Pick a unit for ${ingredient}.` };
    lines.push({ amount, unit, ingredient, note: text(line.note).slice(0, 200) });
  }
  const stepTexts = list(raw.steps).map(text).filter(Boolean);
  return { title, feeds: feeds as number, types, tags, ageFromMonths, ageToMonths, lines, steps: stepTexts };
}

