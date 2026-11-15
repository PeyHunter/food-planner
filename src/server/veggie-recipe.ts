import Anthropic from "@anthropic-ai/sdk";
import { and, asc, eq } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { mainTypes, type MainType, type PhotoRecipeDraft } from "../shared/recipes.ts";
import { units } from "../shared/units.ts";
import type { AppDependencies } from "./app.ts";
import { model, toDraft, type PhotoRecipeClient } from "./photo-recipe.ts";
import { kitchenMember, recipeSummaries, type MemberEnv } from "./recipes.ts";
import { ingredients, recipeLines, recipes, steps } from "./schema.ts";

type CreateParams = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;

/** What the cook picked to put in place of the meat. */
export type Replacement = "tofu" | "vegetables" | { custom: string };

const timeoutMs = 60_000;
// Same name as the photo flow's tool, so its fake client answers this call too.
const toolName = "save_recipe";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const notSetUp = "Make vegetarian isn't set up yet.";
const notMeat = "Only grown-up recipes with meat or chicken can be made vegetarian.";
const badReplacement = "Pick tofu, vegetables or write what to use instead.";
const noRecipe = "We couldn't make a vegetarian version. Try again, or pick something else instead of the meat.";
const tooSlow = "Making the vegetarian version took too long. Try again.";
const busy = "The recipe service is busy right now. Try again in a minute.";
const badKey = "Make vegetarian isn't set up right. The API key may be wrong.";

const nullable = (schema: object) => ({ anyOf: [schema, { type: "null" }] });

const tool: Anthropic.Beta.Messages.BetaTool = {
  name: toolName,
  description: "Save the vegetarian version of the recipe.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["title", "mainTypes", "lines", "steps"],
    properties: {
      title: { type: "string", description: "The recipe's name with the replacement in it, e.g. Golden curry with tofu." },
      mainTypes: { type: "array", items: { type: "string", enum: ["Vegetarian", "Vegetables"] }, description: "Vegetarian, plus Vegetables if the dish is mostly vegetables." },
      lines: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["amount", "unit", "ingredient", "note"],
          properties: {
            amount: nullable({ type: "number" }),
            unit: nullable({ type: "string", enum: [...units] }),
            ingredient: { type: "string", description: "Just the ingredient, e.g. tofu." },
            note: { type: "string", description: "Extra words like cut in cubes. Empty if none." },
          },
        },
      },
      steps: { type: "array", items: { type: "string" }, description: "One entry per step, in order." },
    },
  },
};

const system = `You turn recipes with meat or chicken into vegetarian ones and save them with the ${toolName} tool. Always answer by calling ${toolName} once.
- Swap every meat, chicken and fish ingredient for the replacement the cook picked, in a sensible amount for the same number of people. Swap meat or chicken stock for vegetable stock, and fish sauce, oyster sauce and the like for a vegetarian option.
- Keep every other ingredient, amount and note as it is.
- Change only the steps that need it, e.g. press and fry the tofu before it goes in. Keep the cook's own words in the rest.
- The title gets the replacement, e.g. "Golden curry with tofu". Write in the language the recipe is written in.
- Units must be one of: ${units.join(", ")}. Amounts are numbers. If there is no amount, set amount and unit to null.`;

const replacementText = (replacement: Replacement) =>
  replacement === "tofu" ? "tofu" : replacement === "vegetables" ? "vegetables (pick ones that suit the dish)" : replacement.custom;

/** The body's replacement, or undefined when it isn't one we accept. */
export function parseReplacement(body: unknown): Replacement | undefined {
  const value = body && typeof body === "object" ? (body as Record<string, unknown>).replacement : undefined;
  if (value === "tofu" || value === "vegetables") return value;
  const custom = value && typeof value === "object" ? (value as Record<string, unknown>).custom : undefined;
  if (typeof custom !== "string") return undefined;
  const trimmed = custom.trim();
  return trimmed && trimmed.length <= 100 ? { custom: trimmed } : undefined;
}

/** Sends the recipe and returns what the tool call held, or undefined when the model didn't call it. */
export async function rewriteRecipe(client: PhotoRecipeClient, recipe: object, replacement: Replacement, signal: AbortSignal) {
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
            { type: "text", text: `Make this recipe vegetarian. Use ${replacementText(replacement)} instead of the meat.` },
            { type: "text", text: JSON.stringify(recipe) },
          ],
        },
      ],
    } satisfies CreateParams,
    { signal, maxRetries: 1 },
  );
  if (message.stop_reason === "refusal") return undefined;
  const call = message.content.find((block) => block.type === "tool_use" && block.name === toolName);
  return call && "input" in call ? call.input : undefined;
}

function failure(c: Context, error: unknown, signal: AbortSignal) {
  if (signal.aborted) return c.json({ error: tooSlow }, 504);
  // Status and type only: never the key or the request.
  const status = error instanceof Anthropic.APIError ? error.status : undefined;
  console.error(`make vegetarian failed: ${status ?? (error as Error).name}`);
  if (status === 401 || status === 403) return c.json({ error: badKey }, 503);
  return c.json({ error: busy }, 503);
}

export function createVeggieRecipeRoutes({ database, now, photoRecipeClient }: AppDependencies) {
  const { db } = database;
  const routes = new Hono<MemberEnv>();
  const member = kitchenMember({ database, now });

  routes.post("/api/recipes/:id/vegetarian", member, async (c) => {
    const id = c.req.param("id");
    if (!uuidPattern.test(id)) return c.json({ error: "No such recipe." }, 404);
    const [row] = await db
      .select({ id: recipes.id, title: recipes.title, description: recipes.description, feeds: recipes.feeds, ageFromMonths: recipes.ageFromMonths, ageToMonths: recipes.ageToMonths })
      .from(recipes)
      .where(and(eq(recipes.id, id), eq(recipes.kitchenId, c.get("member").kitchenId)));
    if (!row) return c.json({ error: "No such recipe." }, 404);
    const [summary] = await recipeSummaries(database, [row]);
    const types: readonly string[] = summary!.types;
    if (row.ageFromMonths !== null || row.ageToMonths !== null || !(types.includes("Meat") || types.includes("Chicken"))) return c.json({ error: notMeat }, 400);
    const replacement = parseReplacement(await c.req.json().catch(() => undefined));
    if (!replacement) return c.json({ error: badReplacement }, 400);
    if (!photoRecipeClient) return c.json({ error: notSetUp }, 503);

    const [lines, stepRows] = await Promise.all([
      db
        .select({ amount: recipeLines.amount, unit: recipeLines.unit, ingredient: ingredients.name, note: recipeLines.note })
        .from(recipeLines)
        .innerJoin(ingredients, eq(ingredients.id, recipeLines.ingredientId))
        .where(eq(recipeLines.recipeId, id))
        .orderBy(asc(recipeLines.position)),
      db.select({ text: steps.text }).from(steps).where(eq(steps.recipeId, id)).orderBy(asc(steps.position)),
    ]);
    const original = { title: row.title, feeds: row.feeds, lines, steps: stepRows.map((step) => step.text) };
    const signal = AbortSignal.timeout(timeoutMs);
    try {
      const output = await rewriteRecipe(photoRecipeClient, original, replacement, signal);
      if (output === undefined) return c.json({ error: noRecipe }, 422);
      // Description, feeds and tags stay the original's; only the meat changes.
      const draft = toDraft({ ...(output as object), description: row.description, feeds: row.feeds, tags: summary!.tags }, summary!.tags);
      if (!draft.recipe.lines.length) return c.json({ error: noRecipe }, 422);
      const kept = draft.recipe.types.filter((type): type is MainType => type === "Vegetarian" || type === "Vegetables");
      draft.recipe.types = mainTypes.filter((type) => type === "Vegetarian" || kept.includes(type));
      if (!draft.recipe.title) draft.recipe.title = row.title;
      draft.notes = draft.notes.filter((note) => !note.startsWith("We couldn't read a name"));
      return c.json({ ...draft, dishPhoto: null } satisfies PhotoRecipeDraft);
    } catch (error) {
      return failure(c, error, signal);
    }
  });

  return routes;
}
