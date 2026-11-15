import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { expect, test } from "vitest";
import { fakeClient, model, toDraft, type PhotoRecipeClient } from "../src/server/photo-recipe.ts";
import type { PhotoRecipeDraft } from "../src/shared/recipes.ts";
import { createTestApp, startingUsers } from "./support/test-app.ts";

type CreateParams = Parameters<PhotoRecipeClient["beta"]["messages"]["create"]>[0];

const photo = async (width = 3000, height = 2000) =>
  new File([new Uint8Array(await sharp({ create: { width, height, channels: 3, background: "#f4ecd8" } }).jpeg().toBuffer())], "recipe.jpg", { type: "image/jpeg" });

async function setUp(photoRecipeClient?: PhotoRecipeClient) {
  const app = await createTestApp({ photoRecipeClient });
  const { cookie } = await app.logIn("peyton", startingUsers[0]!.password);
  const send = async (...files: File[]) => {
    const form = new FormData();
    for (const file of files) form.append("photos", file);
    return app.request("/api/recipes/from-photo", { method: "POST", headers: { cookie: cookie! }, body: form });
  };
  const ready = async () => (await (await app.request("/api/photo-recipe", { headers: { cookie: cookie! } })).json()) as { ready: boolean };
  return { app, send, ready };
}

test("photos go to the API shrunk, as base64 JPEG, with the typed tool; the tool's answer comes back as a draft", async () => {
  const calls: CreateParams[] = [];
  const client = fakeClient(
    {
      title: "Mormors frikadeller",
      feeds: 6,
      mainTypes: ["Meat", "Pasta"],
      tags: ["freezable"],
      lines: [
        { amount: 500, unit: "g", ingredient: "Minced pork", note: "" },
        { amount: 1, unit: "pcs", ingredient: "Onion", note: "grated" },
        { amount: null, unit: null, ingredient: "Salt", note: "to taste" },
      ],
      steps: ["Mix everything.", "Fry in butter."],
    },
    calls,
  );
  const { send, ready } = await setUp(client);
  expect(await ready()).toEqual({ ready: true });

  const response = await send(await photo(), await photo(1000, 1500));
  expect(response.status).toBe(200);
  const draft = (await response.json()) as PhotoRecipeDraft;
  expect(draft).toEqual({
    recipe: {
      title: "Mormors frikadeller",
      feeds: 6,
      types: ["Meat"],
      tags: ["freezable"],
      ageFromMonths: null,
      ageToMonths: null,
      lines: [
        { amount: 500, unit: "g", ingredient: "Minced pork", note: "" },
        { amount: 1, unit: "pcs", ingredient: "Onion", note: "grated" },
        { amount: null, unit: null, ingredient: "Salt", note: "to taste" },
      ],
      steps: ["Mix everything.", "Fry in butter."],
    },
    notes: [],
  });

  expect(calls).toHaveLength(1);
  const params = calls[0]!;
  expect(params.model).toBe(model);
  expect(params.tools?.[0]).toMatchObject({ name: "save_recipe", strict: true });
  expect(params.tool_choice).toMatchObject({ type: "auto" });
  const content = params.messages[0]!.content as Anthropic.Beta.Messages.BetaContentBlockParam[];
  const images = content.filter((block) => block.type === "image");
  expect(images).toHaveLength(2);
  for (const image of images) expect(image.source).toMatchObject({ type: "base64", media_type: "image/jpeg" });
  const sizes = await Promise.all(images.map(async (image) => sharp(Buffer.from((image.source as { data: string }).data, "base64")).metadata()));
  expect(sizes.map(({ width, height }) => [width, height])).toEqual([
    [1600, 1067],
    [1000, 1500],
  ]);
});

test("cups, ounces and spelled-out units become metric; unknown units move into the note", () => {
  const { recipe, notes } = toDraft({
    title: "Pancakes",
    feeds: 4,
    mainTypes: ["Vegetarian"],
    tags: [],
    lines: [
      { amount: 2, unit: "cups", ingredient: "Milk", note: "" },
      { amount: "1 1/2", unit: "Tablespoons", ingredient: "Sugar", note: "" },
      { amount: 8, unit: "oz", ingredient: "Flour", note: "sifted" },
      { amount: 1, unit: "lb", ingredient: "Butter", note: "" },
      { amount: 3, unit: "", ingredient: "Egg", note: "" },
      { amount: 1, unit: "pinch", ingredient: "Salt", note: "" },
    ],
    steps: ["Whisk."],
  });
  expect(notes).toEqual([]);
  expect(recipe.lines).toEqual([
    { amount: 4.8, unit: "dl", ingredient: "Milk", note: "" },
    { amount: 1.5, unit: "tbsp", ingredient: "Sugar", note: "" },
    { amount: 227, unit: "g", ingredient: "Flour", note: "sifted" },
    { amount: 454, unit: "g", ingredient: "Butter", note: "" },
    { amount: 3, unit: "pcs", ingredient: "Egg", note: "" },
    { amount: null, unit: null, ingredient: "Salt", note: "1 pinch" },
  ]);
});

test("lines the recipe parser refuses are left out with a note; bad feeds, types and tags are tidied", () => {
  const { recipe, notes } = toDraft(
    {
      title: "",
      feeds: 0,
      mainTypes: ["Dessert"],
      tags: ["x".repeat(41), "sweet", "sweet"],
      lines: [
        { amount: -1, unit: "g", ingredient: "Butter", note: "" },
        { amount: 2, unit: "g", ingredient: "", note: "" },
        { amount: "lots", unit: "g", ingredient: "Sugar", note: "" },
        "not a line",
        { amount: 100, unit: "g", ingredient: "Flour", note: "" },
      ],
      steps: ["Bake.", "", 7],
    },
    ["sweet"],
  );
  expect(recipe).toMatchObject({ title: "", feeds: 4, types: [], tags: ["sweet"], steps: ["Bake."] });
  expect(recipe.lines).toEqual([{ amount: 100, unit: "g", ingredient: "Flour", note: "" }]);
  expect(notes).toEqual([
    "Left out a line (Butter): The amount for Butter must be a number above 0.",
    "Left out a line (no ingredient): Every ingredient line needs an ingredient.",
    "Left out a line (Sugar): The amount for Sugar must be a number above 0.",
    "Left out a line (no ingredient): Every ingredient line needs an ingredient.",
    "We couldn't read a name. Add one before you save.",
  ]);
});

test("only tags the kitchen already uses, or the built-in ones, are kept; made-up tags are dropped", async () => {
  const calls: CreateParams[] = [];
  const { app, send } = await setUp(
    fakeClient({ title: "Fish cakes", feeds: 4, mainTypes: ["Fish"], tags: ["fish cakes", "Kid-Friendly", "QUICK", "for runi"], lines: [], steps: ["Fry."] }, calls),
  );
  const { cookie } = await app.logIn("peyton", startingUsers[0]!.password);
  const saved = await app.request("/api/recipes", {
    method: "POST",
    headers: { cookie: cookie!, "content-type": "application/json" },
    body: JSON.stringify({ title: "Toast", feeds: 1, types: ["Vegetarian"], tags: ["Quick"], lines: [], steps: [] }),
  });
  expect(saved.status).toBe(201);

  const draft = (await (await send(await photo())).json()) as PhotoRecipeDraft;
  expect(draft.recipe.tags).toEqual(["kid-friendly", "Quick", "for Runi"]);
  const content = calls[0]!.messages[0]!.content as Anthropic.Beta.Messages.BetaContentBlockParam[];
  expect(content.at(-1)).toEqual({ type: "text", text: "Tags you may use: freezable, kid-friendly, for Runi, Quick." });
});

test("an answer with no recipe in it, or no tool call at all, says the photo couldn't be read", async () => {
  const empty = await setUp(fakeClient({ title: "", feeds: 4, mainTypes: [], tags: [], lines: [], steps: [] }));
  const response = await empty.send(await photo());
  expect(response.status).toBe(422);
  expect(await response.json()).toEqual({ error: "We couldn't read a recipe in that photo. Try a sharper photo with the whole recipe in it." });

  const chatty: PhotoRecipeClient = {
    beta: { messages: { create: async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: "I can't see a recipe." }] }) as unknown as Anthropic.Beta.Messages.BetaMessage } },
  };
  expect((await (await setUp(chatty)).send(await photo())).status).toBe(422);
});

test("without the API key the feature says it isn't set up yet", async () => {
  const { send, ready } = await setUp();
  expect(await ready()).toEqual({ ready: false });
  const response = await send(await photo());
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "Photo to recipe isn't set up yet." });
});

test("no photo, too many photos, or a file that isn't a photo get a plain answer and never reach the API", async () => {
  const calls: CreateParams[] = [];
  const { send } = await setUp(fakeClient({}, calls));
  expect((await send()).status).toBe(400);
  expect(await (await send(await photo(), await photo(), await photo(), await photo())).json()).toEqual({ error: "Pick at most 3 photos." });
  const notPhoto = await send(new File(["hello"], "note.txt", { type: "text/plain" }));
  expect(notPhoto.status).toBe(400);
  expect(await notPhoto.json()).toEqual({ error: "That file isn't a photo we can read. Try a JPEG or PNG." });
  expect(calls).toHaveLength(0);
});

test("API errors become friendly messages", async () => {
  const failing = (error: Error): PhotoRecipeClient => ({
    beta: {
      messages: {
        create: async () => {
          throw error;
        },
      },
    },
  });
  const wrongKey = await setUp(failing(new Anthropic.AuthenticationError(401, { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }, "invalid x-api-key", new Headers())));
  const answer = await wrongKey.send(await photo());
  expect(answer.status).toBe(503);
  expect(await answer.json()).toEqual({ error: "Photo to recipe isn't set up right. The API key may be wrong." });

  const down = await setUp(failing(new Anthropic.InternalServerError(529, undefined, "overloaded", new Headers())));
  expect(await (await down.send(await photo())).json()).toEqual({ error: "The reading service is busy right now. Try again in a minute." });
});
