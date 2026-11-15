import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import sharp from "sharp";
import { builtInTags, mainTypes, type PhotoRecipeDraft, type RecipeInput } from "../shared/recipes.ts";
import { isUnit, units, type Unit } from "../shared/units.ts";
import type { AppDependencies } from "./app.ts";
import { kitchenMember, parseInput, type MemberEnv } from "./recipes.ts";
import { recipes, recipeTags } from "./schema.ts";

type CreateParams = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;
type RequestOptions = { signal: AbortSignal; maxRetries: number };
/** The one call this feature makes. Tests pass a fake with the same shape, so they never touch the network. */
export type PhotoRecipeClient = { beta: { messages: { create(params: CreateParams, options: RequestOptions): Promise<Anthropic.Beta.Messages.BetaMessage> } } };

export const model = "claude-sonnet-5-5";
const timeoutMs = 60_000;
const maxPhotos = 3;
const maxSide = 1600;
const megabyte = 1024 * 1024;
const toolName = "save_recipe";

export const notSetUp = "Photo to recipe isn't set up yet.";
const unreadablePhoto = "That file isn't a photo we can read. Try a JPEG or PNG.";
const noRecipe = "We couldn't read a recipe in that photo. Try a sharper photo with the whole recipe in it.";
const tooSlow = "Reading the recipe took too long. Try again, maybe with fewer or sharper photos.";
const busy = "The reading service is busy right now. Try again in a minute.";
const badKey = "Photo to recipe isn't set up right. The API key may be wrong.";

const nullable = (schema: object) => ({ anyOf: [schema, { type: "null" }] });

const tool: Anthropic.Beta.Messages.BetaTool = {
  name: toolName,
  description: "Save the recipe read from the photos.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["title", "description", "feeds", "mainTypes", "tags", "lines", "steps", "dishPhoto"],
    properties: {
      title: { type: "string", description: "The recipe's name, as written." },
      description: { type: "string", description: "The short text about the dish, like a book's intro above the recipe, in the cook's words. Empty if there is none." },
      feeds: { type: "integer", description: "How many people it feeds. 4 if the recipe doesn't say." },
      mainTypes: { type: "array", items: { type: "string", enum: [...mainTypes] }, description: "What the dish is mostly made of. Pick one or more." },
      tags: { type: "array", items: { type: "string" }, description: "Only tags from the list in the message. Empty if none fit." },
      lines: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["amount", "unit", "ingredient", "note"],
          properties: {
            amount: nullable({ type: "number" }),
            unit: nullable({ type: "string", enum: [...units] }),
            ingredient: { type: "string", description: "Just the ingredient, e.g. carrot." },
            note: { type: "string", description: "Extra words like finely chopped. Empty if none." },
          },
        },
      },
      steps: { type: "array", items: { type: "string" }, description: "One entry per step, in order." },
      dishPhoto: nullable({
        type: "object",
        additionalProperties: false,
        required: ["photo", "left", "top", "right", "bottom"],
        description: "Where the printed picture of the finished dish is, if a photo has one. Null if there is no such picture.",
        properties: {
          photo: { type: "integer", description: "Which photo it is in, counting from 1." },
          left: { type: "number", description: "Left edge, as a fraction of the photo's width (0 to 1)." },
          top: { type: "number", description: "Top edge, as a fraction of the photo's height (0 to 1)." },
          right: { type: "number", description: "Right edge, as a fraction of the photo's width (0 to 1)." },
          bottom: { type: "number", description: "Bottom edge, as a fraction of the photo's height (0 to 1)." },
        },
      }),
    },
  },
};

const system = `You read photos of written, handwritten or printed recipes and save them with the ${toolName} tool. Always answer by calling ${toolName} once.
- Write the recipe in the language it is written in. Keep the cook's own words in the steps.
- Units must be one of: ${units.join(", ")}. Convert anything else to metric: 1 cup = 2.4 dl, 1 oz = 28 g, 1 lb = 450 g, 1 fl oz = 30 ml. Use pcs for things you count (2 eggs = 2 pcs).
- Amounts are numbers (½ = 0.5). If there is no amount, like "salt to taste", set amount and unit to null and put the words in note.
- If a part can't be read, leave it out rather than guess.
- Recipe books often print a picture of the finished dish next to the recipe. If you see one, give its edges in dishPhoto, tight around the picture, without the text around it. Drawings, ingredient shots and the page itself don't count.`;

// Units the model may still send, and how they become allowed ones.
const unitAliases: Record<string, { unit: Unit; factor: number }> = {
  cup: { unit: "dl", factor: 2.4 },
  cups: { unit: "dl", factor: 2.4 },
  oz: { unit: "g", factor: 28.35 },
  ounce: { unit: "g", factor: 28.35 },
  ounces: { unit: "g", factor: 28.35 },
  lb: { unit: "g", factor: 453.6 },
  lbs: { unit: "g", factor: 453.6 },
  pound: { unit: "g", factor: 453.6 },
  pounds: { unit: "g", factor: 453.6 },
  "fl oz": { unit: "ml", factor: 29.57 },
  pint: { unit: "ml", factor: 473 },
  quart: { unit: "l", factor: 0.946 },
  gram: { unit: "g", factor: 1 },
  grams: { unit: "g", factor: 1 },
  kilo: { unit: "kg", factor: 1 },
  litre: { unit: "l", factor: 1 },
  liter: { unit: "l", factor: 1 },
  teaspoon: { unit: "tsp", factor: 1 },
  teaspoons: { unit: "tsp", factor: 1 },
  tablespoon: { unit: "tbsp", factor: 1 },
  tablespoons: { unit: "tbsp", factor: 1 },
  piece: { unit: "pcs", factor: 1 },
  pieces: { unit: "pcs", factor: 1 },
};

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const list = (value: unknown) => (Array.isArray(value) ? value : []);

/** "1/2", "1 1/2" and "0,5" as numbers; anything else unchanged. */
function toAmount(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const written = value.trim().replace(",", ".");
  if (written === "") return null;
  const mixed = /^(?:(\d+)\s+)?(\d+)\/(\d+)$/.exec(written);
  if (mixed) return Number(mixed[1] ?? 0) + Number(mixed[2]) / Number(mixed[3]);
  return Number.isFinite(Number(written)) ? Number(written) : value;
}

/** An allowed unit, converted to metric when needed. A unit we don't know (a pinch) moves into the note with its amount. */
function toMetric(amount: unknown, unit: unknown): { amount: unknown; unit: unknown; extra: string } {
  const written = typeof unit === "string" ? unit.trim().toLowerCase().replace(/\.$/, "") : unit;
  if (written === "" || written === null || written === undefined) return { amount, unit: typeof amount === "number" ? "pcs" : null, extra: "" };
  if (isUnit(written)) return { amount, unit: written, extra: "" };
  const alias = typeof written === "string" ? unitAliases[written] : undefined;
  if (alias) return { amount: typeof amount === "number" ? Number((amount * alias.factor).toPrecision(3)) : amount, unit: alias.unit, extra: "" };
  if (typeof written !== "string") return { amount, unit, extra: "" };
  return { amount: null, unit: null, extra: typeof amount === "number" ? `${amount} ${written}` : written };
}

/** Turns what the model sent into a draft for the edit form. Lines the recipe parser would refuse are left out, each with a note saying why.
 * Tags the kitchen doesn't use yet are dropped, so the model can't invent new ones. */
export function toDraft(output: unknown, knownTags: readonly string[] = builtInTags): Omit<PhotoRecipeDraft, "dishPhoto"> {
  const spelling = new Map([...builtInTags, ...knownTags].map((tag) => [tag.toLowerCase(), tag]));
  const raw = (output && typeof output === "object" ? output : {}) as Record<string, unknown>;
  const notes: string[] = [];
  const lines: RecipeInput["lines"] = [];
  for (const value of list(raw.lines)) {
    const line = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
    const { amount, unit, extra } = toMetric(toAmount(line.amount), line.unit);
    const candidate = { amount, unit, ingredient: line.ingredient, note: [extra, text(line.note)].filter(Boolean).join(", ") };
    // The same rules a saved recipe follows, checked one line at a time.
    const checked = parseInput({ title: "line", feeds: 1, types: [mainTypes[0]], lines: [candidate] });
    if ("error" in checked) notes.push(`Left out a line (${text(line.ingredient) || "no ingredient"}): ${checked.error}`);
    else lines.push(checked.lines[0]!);
  }
  const feeds = Number.isInteger(raw.feeds) && (raw.feeds as number) >= 1 && (raw.feeds as number) <= 100 ? (raw.feeds as number) : 4;
  const recipe: RecipeInput = {
    title: text(raw.title).slice(0, 200),
    description: text(raw.description).slice(0, 2000),
    feeds,
    types: mainTypes.filter((type) => list(raw.mainTypes).includes(type)),
    tags: [...new Set(list(raw.tags).map((tag) => spelling.get(text(tag).toLowerCase())).filter((tag) => tag !== undefined))].slice(0, 10),
    ageFromMonths: null,
    ageToMonths: null,
    lines,
    steps: list(raw.steps).map(text).filter(Boolean),
  };
  if (!recipe.title) notes.push("We couldn't read a name. Add one before you save.");
  return { recipe, notes };
}

/** Edges of the dish picture as fractions of a photo, checked. */
export type DishBox = { photo: number; left: number; top: number; right: number; bottom: number };

/** The model's dishPhoto, or undefined when it is missing, points at a photo that wasn't sent, or is too small to be a real picture. */
export function toDishBox(output: unknown, photoCount: number): DishBox | undefined {
  const raw = output && typeof output === "object" ? (output as Record<string, unknown>).dishPhoto : undefined;
  if (!raw || typeof raw !== "object") return undefined;
  const { photo, left, top, right, bottom } = raw as Record<string, unknown>;
  if (!Number.isInteger(photo) || (photo as number) < 1 || (photo as number) > photoCount) return undefined;
  const edges = [left, top, right, bottom];
  if (!edges.every((edge) => typeof edge === "number" && Number.isFinite(edge))) return undefined;
  const clamp = (edge: number) => Math.min(1, Math.max(0, edge));
  const box = { photo: photo as number, left: clamp(left as number), top: clamp(top as number), right: clamp(right as number), bottom: clamp(bottom as number) };
  // Anything under a tenth of the side each way is a misread, not a dish picture.
  if (box.right - box.left < 0.1 || box.bottom - box.top < 0.1) return undefined;
  return box;
}

/** Cuts the dish picture out of the full photo (not the shrunk copy, so it stays sharp) as a JPEG data URL, at most 1600 px. */
export async function cutOutDish(photo: Uint8Array, box: DishBox): Promise<string | null> {
  try {
    const { data, info } = await sharp(photo, { failOn: "error" }).rotate().toBuffer({ resolveWithObject: true });
    const left = Math.floor(box.left * info.width);
    const top = Math.floor(box.top * info.height);
    const width = Math.max(1, Math.min(info.width - left, Math.ceil((box.right - box.left) * info.width)));
    const height = Math.max(1, Math.min(info.height - top, Math.ceil((box.bottom - box.top) * info.height)));
    const bytes = await sharp(data)
      .extract({ left, top, width, height })
      .resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    return `data:image/jpeg;base64,${bytes.toString("base64")}`;
  } catch {
    // The recipe is still worth having without its picture.
    return null;
  }
}

class Unreadable extends Error {}

/** Upright, at most 1600 px on the long side, as JPEG: smaller to send and enough to read handwriting. */
async function shrink(photo: File) {
  try {
    const bytes = await sharp(new Uint8Array(await photo.arrayBuffer()), { failOn: "error" })
      .rotate()
      .resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    return bytes.toString("base64");
  } catch {
    throw new Unreadable();
  }
}

/** Sends the photos and returns what the tool call held, or undefined when the model didn't call it. */
export async function readRecipe(client: PhotoRecipeClient, images: string[], signal: AbortSignal, tags: readonly string[] = builtInTags) {
  const message = await client.beta.messages.create(
    {
      model,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system,
      tools: [tool],
      // Forced tool_choice is refused by this model, so the prompt asks for the tool and strict keeps its input to the schema.
      tool_choice: { type: "auto", disable_parallel_tool_use: true },
      messages: [
        {
          role: "user",
          content: [
            ...images.map((data) => ({ type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data } })),
            { type: "text", text: images.length > 1 ? `These ${images.length} photos are pages of one recipe, in order. Save it.` : "Save the recipe in this photo." },
            { type: "text", text: `Tags you may use: ${tags.join(", ")}.` },
          ],
        },
      ],
    },
    { signal, maxRetries: 1 },
  );
  if (message.stop_reason === "refusal") return undefined;
  const call = message.content.find((block) => block.type === "tool_use" && block.name === toolName);
  return call && "input" in call ? call.input : undefined;
}

/** Stands in for the API when PHOTO_RECIPE_FAKE is set (browser tests) and in unit tests: always "reads" `output`. */
export function fakeClient(output: unknown, calls: CreateParams[] = []): PhotoRecipeClient {
  return {
    beta: {
      messages: {
        async create(params) {
          calls.push(params);
          return {
            id: "msg_fake",
            type: "message",
            role: "assistant",
            model,
            stop_reason: "tool_use",
            content: [{ type: "tool_use", id: "toolu_fake", name: toolName, input: output }],
          } as unknown as Anthropic.Beta.Messages.BetaMessage;
        },
      },
    },
  };
}

function failure(c: Context, error: unknown, signal: AbortSignal) {
  if (error instanceof Unreadable) return c.json({ error: unreadablePhoto }, 400);
  if (signal.aborted) return c.json({ error: tooSlow }, 504);
  // Status and type only: never the key, the photos or the request.
  const status = error instanceof Anthropic.APIError ? error.status : undefined;
  console.error(`photo to recipe failed: ${status ?? (error as Error).name}`);
  if (status === 401 || status === 403) return c.json({ error: badKey }, 503);
  return c.json({ error: busy }, 503);
}

export function createPhotoRecipeRoutes({ database, now, photoRecipeClient }: AppDependencies) {
  const routes = new Hono<MemberEnv>();
  const member = kitchenMember({ database, now });

  routes.get("/api/photo-recipe", member, (c) => c.json({ ready: Boolean(photoRecipeClient) }));

  routes.post("/api/recipes/from-photo", member, bodyLimit({ maxSize: 25 * megabyte, onError: (c) => c.json({ error: "Those photos are too big. Try smaller ones." }, 413) }), async (c) => {
    if (!photoRecipeClient) return c.json({ error: notSetUp }, 503);
    const body = await c.req.parseBody({ all: true });
    const photos = [body.photos ?? []].flat().filter((value): value is File => value instanceof File);
    if (!photos.length) return c.json({ error: "Take or pick a photo first." }, 400);
    if (photos.length > maxPhotos) return c.json({ error: `Pick at most ${maxPhotos} photos.` }, 400);
    const signal = AbortSignal.timeout(timeoutMs);
    try {
      // One at a time: the pod has little memory.
      const images: string[] = [];
      for (const photo of photos) images.push(await shrink(photo));
      const used = await database.db
        .selectDistinct({ tag: recipeTags.tag })
        .from(recipeTags)
        .innerJoin(recipes, eq(recipes.id, recipeTags.recipeId))
        .where(eq(recipes.kitchenId, c.get("member").kitchenId));
      const tags = [...new Map([...builtInTags, ...used.map((row) => row.tag)].map((tag) => [tag.toLowerCase(), tag])).values()];
      const output = await readRecipe(photoRecipeClient, images, signal, tags);
      if (output === undefined) return c.json({ error: noRecipe }, 422);
      const draft = toDraft(output, tags);
      if (!draft.recipe.title && !draft.recipe.lines.length && !draft.recipe.steps.length) return c.json({ error: noRecipe }, 422);
      const box = toDishBox(output, photos.length);
      const dishPhoto = box ? await cutOutDish(new Uint8Array(await photos[box.photo - 1]!.arrayBuffer()), box) : null;
      return c.json({ ...draft, dishPhoto } satisfies PhotoRecipeDraft);
    } catch (error) {
      return failure(c, error, signal);
    }
  });

  return routes;
}
