import { isLanguage, type Language } from "../shared/profile.ts";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { createMiddleware } from "hono/factory";
import { kidTags, mainTypes, shopSections, type Cook, type Ingredient, type IngredientRow, type IngredientSettings, type MainType, type Photo, type Recipe, type RecipeInput, type RecipeSummary, type ShareLink, type SharedRecipe, type ShopSection, sharePhotoMedia } from "../shared/recipes.ts";
import { isUnit } from "../shared/units.ts";
import { childRecipeTag } from "../shared/week.ts";
import { currentSession, type Session } from "./access.ts";
import type { AppDependencies } from "./app.ts";
import type { Database } from "./db.ts";
import { photoStore, sharePhotoFile, smallWidth, type StoredPhoto } from "./photos.ts";
import { groceryOf, guessShopSection } from "../shared/groceries.ts";
import { packsVersion } from "../shared/grocery-packs.ts";
import { nameForms, sameIngredient } from "../shared/ingredient-names.ts";
import { cooks, ingredients, kitchenMembers, kitchens, photos, recipeLines, recipes, recipeTags, recipeTypes, steps, users } from "./schema.ts";

/** `checkedAt` is when the session was checked, so requireRecentAuth needs no clock of its own. */
type Member = { userId: string; kitchenId: string; kids: boolean; language: Language; session: Session; checkedAt: Date };
export type MemberEnv = { Variables: { member: Member } };
type Env = MemberEnv;

const megabyte = 1024 * 1024;
const maxCookPhotos = 6;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const tooBig = (c: Context) => c.json({ error: "That photo is too big. Try a smaller one." }, 413);
const unreadable = "That file isn't a photo we can read. Try a JPEG or PNG.";

const photoUrl = (id: string) => `/api/photos/${id}.jpg`;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const escapeHtml = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const toPhoto = (row: { id: string; role: string; cookId: string | null }): Photo => ({
  id: row.id,
  url: photoUrl(row.id),
  role: row.role === "main" ? "main" : "gallery",
  cookId: row.cookId,
});
// LIKE treats % and _ as wildcards; a search for "50%" means the text.
const likeText = (text: string) => `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

/** Lets only logged-in kitchen members through and sets `member`. */
export const kitchenMember = ({ database, now }: Pick<AppDependencies, "database" | "now">) =>
  createMiddleware<MemberEnv>(async (c, next) => {
    const found = await currentSession(database, now, c);
    if (!found) return c.json({ error: "Not logged in" }, 401);
    const { user, session } = found;
    const [row] = await database.db
      .select({ kitchenId: kitchenMembers.kitchenId, kids: kitchens.kids })
      .from(kitchenMembers)
      .innerJoin(kitchens, eq(kitchens.id, kitchenMembers.kitchenId))
      .where(eq(kitchenMembers.userId, user.id))
      .limit(1);
    if (!row) return c.json({ error: "You are not in a kitchen yet." }, 403);
    c.set("member", { userId: user.id, kitchenId: row.kitchenId, kids: row.kids, language: isLanguage(user.language) ? user.language : "en", session, checkedAt: now() });
    await next();
  });

export function createRecipeRoutes({ database, now, photosDir, publicUrl, webDir }: AppDependencies) {
  const { db } = database;
  const store = photoStore(photosDir);
  const routes = new Hono<Env>();
  const member = kitchenMember({ database, now });
  const summaries = (rows: { id: string; title: string; feeds: number }[]) => recipeSummaries(database, rows);

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
    const id = await db.transaction((tx) => insertRecipe(tx, kitchenId, userId, input));
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

  // Suggestions while typing (8 at most), or with ?all=1 the whole list for the Ingredients screen.
  routes.get("/api/ingredients", member, async (c) => {
    const q = (c.req.query("q") ?? "").trim();
    const all = c.req.query("all") === "1";
    if (!q && !all) return c.json([]);
    const rows = await db
      .select({
        id: ingredients.id,
        name: ingredients.name,
        shopSection: ingredients.shopSection,
        packAmount: ingredients.packAmount,
        packUnit: ingredients.packUnit,
        alwaysAtHome: ingredients.alwaysAtHome,
        recipes: recipeCount,
      })
      .from(ingredients)
      .where(and(eq(ingredients.kitchenId, c.get("member").kitchenId), q ? or(sql`${ingredients.name} ilike ${likeText(q)}`, inArray(sql`lower(${ingredients.name})`, nameForms(q))) : undefined))
      // Names that start with what was typed come first.
      .orderBy(sql`${ingredients.name} ilike ${likeText(q).slice(1)} desc`, asc(sql`lower(${ingredients.name})`))
      .limit(all ? 1000 : 8);
    return c.json(rows.map((row): IngredientRow => ({ ...toIngredient(row), recipes: row.recipes })));
  });

  routes.delete("/api/ingredients/:id", member, async (c) => {
    const id = c.req.param("id");
    if (!uuidPattern.test(id)) return c.json({ error: "No such ingredient." }, 404);
    const mine = and(eq(ingredients.id, id), eq(ingredients.kitchenId, c.get("member").kitchenId));
    const [row] = await db.select({ name: ingredients.name, recipes: recipeCount }).from(ingredients).where(mine);
    if (!row) return c.json({ error: "No such ingredient." }, 404);
    if (row.recipes > 0) return c.json({ error: `${row.name} is in a recipe, so it can't be deleted. Take it out of the recipe first.` }, 409);
    await db.delete(ingredients).where(mine);
    return c.body(null, 204);
  });

  routes.put("/api/ingredients/:id", member, async (c) => {
    const id = c.req.param("id");
    if (!uuidPattern.test(id)) return c.json({ error: "No such ingredient." }, 404);
    const settings = parseIngredientSettings(await c.req.json().catch(() => undefined));
    if ("error" in settings) return c.json(settings, 400);
    const mine = and(eq(ingredients.id, id), eq(ingredients.kitchenId, c.get("member").kitchenId));
    const [before] = await db.select({ packAmount: ingredients.packAmount, packUnit: ingredients.packUnit }).from(ingredients).where(mine);
    if (!before) return c.json({ error: "No such ingredient." }, 404);
    // A pack size someone typed is theirs: catalog updates leave it alone.
    const packChanged = before.packAmount !== settings.packAmount || before.packUnit !== settings.packUnit;
    const [row] = await db
      .update(ingredients)
      .set({ ...settings, ...(packChanged ? { packSource: "user" } : {}) })
      .where(mine)
      .returning();
    if (!row) return c.json({ error: "No such ingredient." }, 404);
    return c.json(toIngredient(row));
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

  /** What a share link shows, or undefined while the link is off. */
  async function sharedView(token: string): Promise<SharedRecipe | undefined> {
    const id = await sharedRecipe(token);
    if (!id) return undefined;
    const { title, description, feeds, minutes, types, tags, mainPhoto, photos: all, lines, steps: stepTexts } = await loadRecipe(id);
    const viaLink = (photo: Photo): Photo => ({ ...photo, url: `/s/${token}/photos/${photo.id}.jpg` });
    const main = mainPhoto && { ...viaLink(mainPhoto), smallUrl: `/s/${token}/photos/${mainPhoto.id}-${smallWidth}.jpg` };
    return { title, description, feeds, minutes, types, tags, mainPhoto: main, photos: all.map(viaLink), lines, steps: stepTexts };
  }

  routes.get("/api/share/:token", async (c) => {
    const shared = await sharedView(c.req.param("token"));
    if (!shared) return c.json({ error: "This link doesn't work any more." }, 404, { "cache-control": "no-store" });
    return c.json(shared, 200, { "cache-control": "no-store" });
  });

  /** Copies a shared recipe, with its photos, into the caller's own kitchen. Their own recipe isn't copied again. */
  routes.post("/api/share/:token/save", member, async (c) => {
    const id = await sharedRecipe(c.req.param("token"));
    if (!id) return c.json({ error: "This link doesn't work any more." }, 404);
    const { kitchenId, userId, kids } = c.get("member");
    const [source] = await db.select({ kitchenId: recipes.kitchenId }).from(recipes).where(eq(recipes.id, id));
    if (!source) return c.json({ error: "This link doesn't work any more." }, 404);
    if (source.kitchenId === kitchenId) return c.json({ id, alreadyYours: true });
    const recipe = await loadRecipe(id);
    const input: RecipeInput = {
      title: recipe.title,
      description: recipe.description,
      feeds: recipe.feeds,
      minutes: recipe.minutes,
      types: recipe.types,
      // "for Runi" names the sender's child, so it never travels; other kid tags only go to kitchens with kids.
      tags: recipe.tags.filter((tag) => tag !== childRecipeTag && (kids || !kidTags.includes(tag))),
      ageFromMonths: kids ? recipe.ageFromMonths : null,
      ageToMonths: kids ? recipe.ageToMonths : null,
      lines: recipe.lines.map((line) => ({ amount: line.amount, unit: line.unit, ingredient: line.ingredient.name, note: line.note })),
      steps: recipe.steps,
    };
    const pictures = await db
      .select({ id: photos.id, role: photos.role, width: photos.width, height: photos.height, bytes: photos.bytes })
      .from(photos)
      .where(and(eq(photos.recipeId, id), isNull(photos.cookId)));
    const copies: typeof pictures = [];
    try {
      for (const photo of pictures) copies.push({ ...photo, id: await store.copy(photo.id) });
    } catch (error) {
      await Promise.all(copies.map((photo) => store.remove(photo.id)));
      throw error;
    }
    const copyId = await db
      .transaction(async (tx) => {
        const [row] = await tx
          .insert(recipes)
          .values({ kitchenId, createdBy: userId, ...recipeColumns(input) })
          .returning({ id: recipes.id });
        await writeParts(tx, row!.id, kitchenId, userId, input);
        if (copies.length) await tx.insert(photos).values(copies.map((photo) => ({ ...photo, recipeId: row!.id, createdBy: userId })));
        return row!.id;
      })
      .catch(async (error: unknown) => {
        await Promise.all(copies.map((photo) => store.remove(photo.id)));
        throw error;
      });
    return c.json({ id: copyId, alreadyYours: false }, 201);
  });

  routes.get("/s/:token/photos/:file", async (c) => {
    const asked = sharePhotoFile(c.req.param("file"));
    const recipeId = await sharedRecipe(c.req.param("token"));
    if (!recipeId || !asked) return c.text("No such photo.", 404);
    const { id, small } = asked;
    const [row] = await db
      .select({ id: photos.id })
      .from(photos)
      .where(and(eq(photos.id, id), eq(photos.recipeId, recipeId)));
    const file = row && (await (small ? store.readSmall(id) : store.read(id)).catch(() => undefined));
    if (!file) return c.text("No such photo.", 404);
    // The full photo: short, so a phone stops showing it soon after the link is turned off.
    // The small copy is what makes the page fast, so a phone keeps it.
    const cache = small ? "private, max-age=31536000, immutable" : "private, max-age=600";
    return c.body(new Uint8Array(file), 200, { "content-type": "image/jpeg", "cache-control": cache });
  });

  let sharePage: Promise<string> | undefined;
  // The recipe and its main photo go into the page itself, so they load alongside the script instead of after it.
  // no-store: a link that was turned off must not come back from the browser's cache.
  routes.get("/s/:token", async (c) => {
    sharePage ??= readFile(join(webDir, "share.html"), "utf8");
    const [html, shared] = await Promise.all([sharePage, sharedView(c.req.param("token"))]);
    const head = shared
      ? `<title>${escapeHtml(shared.title)} · Food planner</title>` +
        (shared.mainPhoto
          ? `<link rel="preload" as="image" href="${escapeHtml(shared.mainPhoto.smallUrl)}" media="${sharePhotoMedia.narrow}" fetchpriority="high" />` +
            `<link rel="preload" as="image" href="${escapeHtml(shared.mainPhoto.url)}" media="${sharePhotoMedia.wide}" fetchpriority="high" />`
          : "")
      : "<title>Food planner</title>";
    const data = `<script id="share-data" type="application/json">${JSON.stringify(shared ?? null).replaceAll("<", "\\u003c")}</script>`;
    const page = html.replace("<title>Food planner</title>", head).replace('<div id="root"></div>', `<div id="root"></div>${data}`);
    return c.html(page, shared ? 200 : 404, { "cache-control": "no-store" });
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

  async function loadRecipe(id: string): Promise<Recipe> {
    const [row] = await db
      .select({
        id: recipes.id,
        title: recipes.title,
        description: recipes.description,
        feeds: recipes.feeds,
        ageFromMonths: recipes.ageFromMonths,
        ageToMonths: recipes.ageToMonths,
        createdBy: sql<string>`coalesce(${users.username}, '')`,
        shareToken: recipes.shareToken,
      })
      .from(recipes)
      .leftJoin(users, eq(users.id, recipes.createdBy))
      .where(eq(recipes.id, id));
    const { createdBy, description, ageFromMonths, ageToMonths, shareToken, ...summaryRow } = row!;
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
      description,
      ageFromMonths,
      ageToMonths,
      createdBy,
      shareUrl: shareLink(shareToken).url,
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

const recipeCount = sql<number>`(select count(distinct ${recipeLines.recipeId})::int from ${recipeLines} where ${recipeLines.ingredientId} = ${ingredients.id})`;

const toIngredient = (row: { id: string; name: string; shopSection: string; packAmount: number | null; packUnit: string | null; alwaysAtHome: boolean }): Ingredient => ({
  id: row.id,
  name: row.name,
  shopSection: row.shopSection as ShopSection,
  packAmount: row.packAmount,
  packUnit: isUnit(row.packUnit) ? row.packUnit : null,
  alwaysAtHome: row.alwaysAtHome,
});

const sortTypes = (types: string[]) => mainTypes.filter((type) => types.includes(type));

/** The shop's usual pack for a name the catalog knows, as ingredient columns; nothing for a name it doesn't. */
export function catalogPack(name: string) {
  const pack = groceryOf(name)?.pack;
  if (!pack) return {};
  return { packAmount: pack.amount, packUnit: pack.unit, pieceGrams: pack.pieceGrams ?? null, packSource: `catalog:${packsVersion}` };
}

/**
 * Puts the catalog's pack sizes on ingredients nobody sized by hand: unsized ones from before the catalog, and ones from an older catalog.
 * A size someone typed is never changed, whether marked "user" or typed before pack sources existed.
 */
export async function applyCatalogPacks({ db }: Database) {
  const current = `catalog:${packsVersion}`;
  const rows = await db
    .select({ id: ingredients.id, name: ingredients.name })
    .from(ingredients)
    .where(or(and(isNull(ingredients.packSource), isNull(ingredients.packAmount)), and(sql`${ingredients.packSource} like 'catalog:%'`, sql`${ingredients.packSource} <> ${current}`)));
  let sized = 0;
  for (const { id, name } of rows) {
    const pack = catalogPack(name);
    if (!pack.packSource) continue;
    await db
      .update(ingredients)
      .set(pack)
      .where(and(eq(ingredients.id, id), or(and(isNull(ingredients.packSource), isNull(ingredients.packAmount)), sql`${ingredients.packSource} like 'catalog:%'`)));
    sized++;
  }
  return sized;
}

/** Gives ingredients still in Other a fresh guess, for names added before the guesser knew them. Other sections may be the user's choice, so they stay. */
export async function reguessOtherShopSections({ db }: Database) {
  const others = await db.select({ id: ingredients.id, name: ingredients.name }).from(ingredients).where(eq(ingredients.shopSection, "Other"));
  let moved = 0;
  for (const { id, name } of others) {
    const section = guessShopSection(name);
    if (section === "Other") continue;
    await db.update(ingredients).set({ shopSection: section }).where(and(eq(ingredients.id, id), eq(ingredients.shopSection, "Other")));
    moved++;
  }
  return moved;
}

export async function recipeSummaries({ db }: Database, rows: { id: string; title: string; feeds: number }[]): Promise<RecipeSummary[]> {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const [times, types, tags, mains, lastCooks] = await Promise.all([
    db.select({ id: recipes.id, minutes: recipes.minutes }).from(recipes).where(inArray(recipes.id, ids)),
    db.select().from(recipeTypes).where(inArray(recipeTypes.recipeId, ids)),
    db.select().from(recipeTags).where(inArray(recipeTags.recipeId, ids)).orderBy(asc(recipeTags.tag)),
    db
      .select({ id: photos.id, recipeId: photos.recipeId, role: photos.role, cookId: photos.cookId })
      .from(photos)
      .where(and(inArray(photos.recipeId, ids), eq(photos.role, "main"))),
    db
      .select({ recipeId: cooks.recipeId, last: sql<string>`max(${cooks.madeOn})::text`, count: sql<number>`count(*)::int` })
      .from(cooks)
      .where(inArray(cooks.recipeId, ids))
      .groupBy(cooks.recipeId),
  ]);
  return rows.map((row) => ({
    ...row,
    minutes: times.find((time) => time.id === row.id)?.minutes ?? null,
    types: sortTypes(types.filter((type) => type.recipeId === row.id).map((type) => type.type)),
    tags: tags.filter((tag) => tag.recipeId === row.id).map((tag) => tag.tag),
    mainPhoto: (() => {
      const main = mains.find((photo) => photo.recipeId === row.id);
      return main ? toPhoto(main) : null;
    })(),
    ...(() => {
      const cooked = lastCooks.find((cook) => cook.recipeId === row.id);
      return { lastMadeOn: cooked?.last ?? null, timesMade: cooked?.count ?? 0 };
    })(),
  }));
}

export type Tx = Parameters<Parameters<Database["db"]["transaction"]>[0]>[0];

async function writeParts(tx: Tx, recipeId: string, kitchenId: string, userId: string | null, input: RecipeInput) {
  if (input.types.length) await tx.insert(recipeTypes).values(input.types.map((type) => ({ recipeId, type })));
  if (input.tags.length) await tx.insert(recipeTags).values(input.tags.map((tag) => ({ recipeId, tag })));
  if (input.steps.length) await tx.insert(steps).values(input.steps.map((text, position) => ({ recipeId, position, text })));
  if (!input.lines.length) return;
  const names = [...new Map(input.lines.map((line) => [line.ingredient.toLowerCase(), line.ingredient])).values()];
  // Existing ones are reused across capitals and singular/plural ("potatoes" uses "potato").
  const known = () =>
    tx
      .select({ id: ingredients.id, name: ingredients.name })
      .from(ingredients)
      .where(and(eq(ingredients.kitchenId, kitchenId), inArray(sql`lower(${ingredients.name})`, names.flatMap(nameForms))));
  const matchIn = (rows: { id: string; name: string }[], name: string) =>
    rows.find((row) => row.name.toLowerCase() === name.toLowerCase()) ?? rows.find((row) => sameIngredient(name, row.name));
  const before = await known();
  const fresh: string[] = [];
  for (const name of names) if (!matchIn(before, name) && !fresh.some((other) => sameIngredient(name, other))) fresh.push(name);
  if (fresh.length)
    await tx
      .insert(ingredients)
      .values(fresh.map((name) => ({ kitchenId, name, shopSection: guessShopSection(name), ...catalogPack(name), createdBy: userId })))
      .onConflictDoNothing();
  const after = fresh.length ? await known() : before;
  const idOf = new Map(names.map((name) => [name.toLowerCase(), matchIn(after, name)!.id]));
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

/** Saves a new recipe; its ingredients reuse the kitchen's by name. Returns its id. */
export async function insertRecipe(tx: Tx, kitchenId: string, userId: string | null, input: RecipeInput) {
  const [row] = await tx
    .insert(recipes)
    .values({ kitchenId, createdBy: userId, ...recipeColumns(input) })
    .returning({ id: recipes.id });
  await writeParts(tx, row!.id, kitchenId, userId, input);
  return row!.id;
}

function recipeColumns(input: RecipeInput) {
  return { title: input.title, description: input.description ?? "", feeds: input.feeds, minutes: input.minutes ?? null, ageFromMonths: input.ageFromMonths, ageToMonths: input.ageToMonths };
}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const list = (value: unknown) => (Array.isArray(value) ? (value as unknown[]) : []);

/** A week. Anything longer is a typo. */
export const maxMinutes = 7 * 24 * 60;

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
  const description = text(raw.description);
  if (description.length > 2000) return { error: "That description is too long. Keep it under 2000 letters." };
  const feeds = raw.feeds;
  if (!Number.isInteger(feeds) || (feeds as number) < 1 || (feeds as number) > 100) return { error: "Feeds must be a whole number from 1 to 100." };
  const minutes = raw.minutes === null || raw.minutes === undefined || raw.minutes === "" ? null : raw.minutes;
  if (minutes !== null && !(Number.isInteger(minutes) && (minutes as number) >= 1 && (minutes as number) <= maxMinutes)) return { error: "Time must be a whole number of minutes." };
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
  return { title, description, feeds: feeds as number, minutes: minutes as number | null, types, tags, ageFromMonths, ageToMonths, lines, steps: stepTexts };
}


export function parseIngredientSettings(body: unknown): IngredientSettings | { error: string } {
  if (!body || typeof body !== "object") return { error: "Send the settings as JSON." };
  const raw = body as Record<string, unknown>;
  if (!shopSections.includes(raw.shopSection as ShopSection)) return { error: "Pick a shop section." };
  const packAmount = raw.packAmount === null || raw.packAmount === undefined || raw.packAmount === "" ? null : raw.packAmount;
  if (packAmount !== null && !(typeof packAmount === "number" && Number.isFinite(packAmount) && packAmount > 0)) return { error: "The pack size must be a number above 0." };
  const packUnit = raw.packUnit === null || raw.packUnit === undefined || raw.packUnit === "" ? null : raw.packUnit;
  if (packUnit !== null && !isUnit(packUnit)) return { error: "Pick a unit for the pack size." };
  if ((packAmount === null) !== (packUnit === null)) return { error: "A pack size needs both an amount and a unit." };
  if (typeof raw.alwaysAtHome !== "boolean") return { error: "Say if it is always at home." };
  return { shopSection: raw.shopSection as ShopSection, packAmount, packUnit, alwaysAtHome: raw.alwaysAtHome };
}
