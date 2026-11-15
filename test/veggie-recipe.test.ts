import Anthropic from "@anthropic-ai/sdk";
import { expect, test } from "vitest";
import { fakeClient, model, type PhotoRecipeClient } from "../src/server/photo-recipe.ts";
import { notSetUp } from "../src/server/veggie-recipe.ts";
import type { PhotoRecipeDraft, RecipeInput } from "../src/shared/recipes.ts";
import { createTestApp, startingUsers } from "./support/test-app.ts";

type CreateParams = Parameters<PhotoRecipeClient["beta"]["messages"]["create"]>[0];

const curry: RecipeInput = {
  title: "Golden curry",
  description: "The Japanese box curry.",
  feeds: 4,
  types: ["Chicken"],
  tags: ["freezable", "weeknight"],
  ageFromMonths: null,
  ageToMonths: null,
  lines: [
    { amount: 500, unit: "g", ingredient: "Chicken thighs", note: "in pieces" },
    { amount: 2, unit: "pcs", ingredient: "Carrot", note: "" },
    { amount: 5, unit: "dl", ingredient: "Chicken stock", note: "" },
  ],
  steps: ["Brown the chicken.", "Add carrots and stock, then the curry blocks."],
};

const tofuCurry = {
  title: "Golden curry with tofu",
  mainTypes: ["Vegetarian", "Vegetables"],
  lines: [
    { amount: 400, unit: "g", ingredient: "Firm tofu", note: "pressed, in cubes" },
    { amount: 2, unit: "pcs", ingredient: "Carrot", note: "" },
    { amount: 5, unit: "dl", ingredient: "Vegetable stock", note: "" },
  ],
  steps: ["Fry the tofu until golden.", "Add carrots and stock, then the curry blocks."],
};

async function setUp(photoRecipeClient?: PhotoRecipeClient) {
  const app = await createTestApp({ photoRecipeClient });
  const { cookie } = await app.logIn("peyton", startingUsers[0]!.password);
  const headers = { cookie: cookie!, "content-type": "application/json" };
  const save = async (input: RecipeInput) => ((await (await app.request("/api/recipes", { method: "POST", headers, body: JSON.stringify(input) })).json()) as { id: string }).id;
  const makeVegetarian = (id: string, replacement: unknown) => app.request(`/api/recipes/${id}/vegetarian`, { method: "POST", headers, body: JSON.stringify({ replacement }) });
  return { app, headers, save, makeVegetarian };
}

test("a chicken curry comes back as a vegetarian draft; description, feeds and tags stay, and nothing is saved", async () => {
  const calls: CreateParams[] = [];
  const { app, headers, save, makeVegetarian } = await setUp(fakeClient(tofuCurry, calls));
  const id = await save(curry);
  const before = await (await app.request("/api/recipes?q=", { headers })).json();

  const response = await makeVegetarian(id, "tofu");
  expect(response.status).toBe(200);
  expect((await response.json()) as PhotoRecipeDraft).toEqual({
    recipe: {
      title: "Golden curry with tofu",
      description: "The Japanese box curry.",
      feeds: 4,
      types: ["Vegetarian", "Vegetables"],
      tags: ["freezable", "weeknight"],
      ageFromMonths: null,
      ageToMonths: null,
      lines: tofuCurry.lines,
      steps: tofuCurry.steps,
    },
    notes: [],
    dishPhoto: null,
  });

  expect(calls).toHaveLength(1);
  const params = calls[0]!;
  expect(params.model).toBe(model);
  expect(params.tools?.[0]).toMatchObject({ name: "save_recipe", strict: true });
  expect(params.tool_choice).toMatchObject({ type: "auto" });
  expect(params.betas).toEqual(["server-side-fallback-2026-07-01"]);
  expect(params.fallbacks).toBe("default");
  const content = params.messages[0]!.content as Anthropic.Beta.Messages.BetaTextBlockParam[];
  expect(content[0]!.text).toContain("Use tofu instead");
  expect(content[1]!.text).toContain("Chicken thighs");

  // The original is untouched and no new recipe was made.
  expect(await (await app.request("/api/recipes?q=", { headers })).json()).toEqual(before);
  expect(((await (await app.request(`/api/recipes/${id}`, { headers })).json()) as { title: string }).title).toBe("Golden curry");
});

test("something else: the cook's own words go to the model", async () => {
  const calls: CreateParams[] = [];
  const { save, makeVegetarian } = await setUp(fakeClient(tofuCurry, calls));
  const response = await makeVegetarian(await save(curry), { custom: "chickpeas" });
  expect(response.status).toBe(200);
  expect(((calls[0]!.messages[0]!.content as Anthropic.Beta.Messages.BetaTextBlockParam[])[0]!).text).toContain("Use chickpeas instead");
});

test("a model that keeps meat types still gives a Vegetarian draft", async () => {
  const { save, makeVegetarian } = await setUp(fakeClient({ ...tofuCurry, mainTypes: ["Chicken"] }));
  const draft = (await (await makeVegetarian(await save(curry), "vegetables")).json()) as PhotoRecipeDraft;
  expect(draft.recipe.types).toEqual(["Vegetarian"]);
});

test("a recipe without meat, or a child's recipe, can't be made vegetarian and never reaches the API", async () => {
  const calls: CreateParams[] = [];
  const { save, makeVegetarian } = await setUp(fakeClient(tofuCurry, calls));
  const veggie = await makeVegetarian(await save({ ...curry, title: "Dal", types: ["Vegetarian"] }), "tofu");
  expect(veggie.status).toBe(400);
  expect(await veggie.json()).toEqual({ error: "Only grown-up recipes with meat or chicken can be made vegetarian." });
  const child = await makeVegetarian(await save({ ...curry, title: "Baby curry", ageFromMonths: 8 }), "tofu");
  expect(child.status).toBe(400);
  expect(calls).toHaveLength(0);
});

test("a missing or empty replacement gets a plain answer; an unknown recipe is not found", async () => {
  const { save, makeVegetarian } = await setUp(fakeClient(tofuCurry));
  const id = await save(curry);
  expect((await makeVegetarian(id, "bacon")).status).toBe(400);
  expect((await makeVegetarian(id, { custom: "  " })).status).toBe(400);
  expect((await makeVegetarian("00000000-0000-4000-8000-000000000000", "tofu")).status).toBe(404);
});

test("without the API key it says it isn't set up yet", async () => {
  const { save, makeVegetarian } = await setUp();
  const response = await makeVegetarian(await save(curry), "tofu");
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: notSetUp });
});

test("API errors become friendly messages", async () => {
  const failing: PhotoRecipeClient = {
    beta: { messages: { create: async () => { throw new Anthropic.APIError(401, undefined, "bad key", new Headers()); } } },
  };
  const { save, makeVegetarian } = await setUp(failing);
  const response = await makeVegetarian(await save(curry), "tofu");
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "Make vegetarian isn't set up right. The API key may be wrong." });
});

test("logged out gets no answer", async () => {
  const { app } = await setUp(fakeClient(tofuCurry));
  const response = await app.request("/api/recipes/00000000-0000-4000-8000-000000000000/vegetarian", { method: "POST", body: "{}" });
  expect(response.status).toBe(401);
});
