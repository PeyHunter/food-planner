import { expect, test } from "vitest";
import { costUsd } from "../src/server/ai-calls.ts";
import { fakeClient, model, type PhotoRecipeClient } from "../src/server/photo-recipe.ts";
import { createTestApp, startingUsers } from "./support/test-app.ts";

test("cost counts input, output and cached tokens at the model's price", () => {
  expect(costUsd("claude-sonnet-5-5", { input_tokens: 1_000_000, output_tokens: 0 })).toBeCloseTo(2);
  expect(costUsd("claude-sonnet-5-5", { input_tokens: 0, output_tokens: 1_000_000 })).toBeCloseTo(10);
  expect(costUsd("claude-sonnet-5-5", { input_tokens: 1000, output_tokens: 500, cache_creation_input_tokens: 2000, cache_read_input_tokens: 10_000 })).toBeCloseTo(0.002 + 0.005 + 0.005 + 0.001);
  expect(costUsd("some-unknown-model", { input_tokens: 1000, output_tokens: 1000 })).toBe(0);
});

test("a vegetarian rewrite is logged with kitchen, user, tokens and cost", async () => {
  const fake = fakeClient({ title: "Tofu curry", mainTypes: ["Vegetarian"], lines: [{ amount: 400, unit: "g", ingredient: "Tofu", note: "" }], steps: ["Fry."] });
  const counted: PhotoRecipeClient = {
    beta: {
      messages: {
        async create(params, options) {
          const message = await fake.beta.messages.create(params, options);
          return { ...message, usage: { ...message.usage, input_tokens: 3000, output_tokens: 800 } };
        },
      },
    },
  };
  const app = await createTestApp({ photoRecipeClient: counted });
  const { cookie } = await app.logIn("peyton", startingUsers[0]!.password);
  const headers = { cookie: cookie!, "content-type": "application/json" };
  const recipe = { title: "Chicken curry", feeds: 4, types: ["Chicken"], tags: [], ageFromMonths: null, ageToMonths: null, lines: [{ amount: 500, unit: "g", ingredient: "Chicken", note: "" }], steps: ["Cook."] };
  const { id } = (await (await app.request("/api/recipes", { method: "POST", headers, body: JSON.stringify(recipe) })).json()) as { id: string };
  expect((await app.request(`/api/recipes/${id}/vegetarian`, { method: "POST", headers, body: JSON.stringify({ replacement: "tofu" }) })).status).toBe(200);

  const rows = await app.query("select u.username, a.feature, a.model, a.input_tokens, a.output_tokens, a.cost_usd, a.kitchen_id = m.kitchen_id as own_kitchen from ai_calls a join users u on u.id = a.user_id join kitchen_members m on m.user_id = u.id");
  expect(rows).toEqual([{ username: "peyton", feature: "vegetarian", model, input_tokens: 3000, output_tokens: 800, cost_usd: "0.014000", own_kitchen: true }]);
});
