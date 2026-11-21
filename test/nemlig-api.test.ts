import { expect, test } from "vitest";
import { createTestApp, startingUsers } from "./support/test-app.ts";

test("a kitchen remembers its nemlig.com word and product link per ingredient", async () => {
  const app = await createTestApp();
  const { cookie } = await app.logIn(startingUsers[0]!.username, startingUsers[0]!.password);
  const call = (path: string, method = "GET", body?: unknown) =>
    app.request(path, { method, headers: { cookie: cookie!, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  await call("/api/recipes", "POST", { title: "Soup", feeds: 2, types: ["Vegetables"], tags: [], ageFromMonths: null, ageToMonths: null, steps: [], lines: [{ amount: 1, unit: "pcs", ingredient: "Chicken breast", note: "" }] });
  const [chicken] = (await (await call("/api/ingredients?all=1")).json()) as { id: string }[];

  expect((await app.request("/api/nemlig/remembered")).status).toBe(401);
  expect(await (await call("/api/nemlig/remembered")).json()).toEqual({});

  const saved = await call(`/api/nemlig/ingredients/${chicken!.id}`, "PUT", { word: " kyllingefilet " });
  expect(await saved.json()).toEqual({ word: "kyllingefilet", link: null });
  await call(`/api/nemlig/ingredients/${chicken!.id}`, "PUT", { link: "https://www.nemlig.com/kyllingebryst-5021812" });
  expect(await (await call("/api/nemlig/remembered")).json()).toEqual({ [chicken!.id]: { word: "kyllingefilet", link: "https://www.nemlig.com/kyllingebryst-5021812" } });

  expect((await call(`/api/nemlig/ingredients/${chicken!.id}`, "PUT", { link: "https://evil.example/nemlig.com" })).status).toBe(400);
  expect((await call(`/api/nemlig/ingredients/${chicken!.id}`, "PUT", { word: "x".repeat(81) })).status).toBe(400);
  expect((await call(`/api/nemlig/ingredients/${chicken!.id}`, "PUT", {})).status).toBe(400);
  expect((await call("/api/nemlig/ingredients/00000000-0000-4000-8000-000000000000", "PUT", { word: "x" })).status).toBe(404);

  // Ronja shares the kitchen, so she sees the same; clearing both forgets it.
  const ronja = await app.logIn(startingUsers[1]!.username, startingUsers[1]!.password);
  expect(Object.keys(await (await app.request("/api/nemlig/remembered", { headers: { cookie: ronja.cookie! } })).json())).toEqual([chicken!.id]);
  await call(`/api/nemlig/ingredients/${chicken!.id}`, "PUT", { word: "", link: null });
  expect(await (await call("/api/nemlig/remembered")).json()).toEqual({});
});
