import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";
import { ensureHousehold } from "../src/server/household.ts";
import { addStarterRecipesOnce } from "../src/server/starter-recipes.ts";
import { annaKitchenExtras } from "../src/shared/extra-recipes.ts";
import { createTestApp } from "./support/test-app.ts";

test("an Anna kitchen gets the starters and the five extras once", async () => {
  const app = await createTestApp();
  const kitchenId = await ensureHousehold(
    app.database,
    [
      { username: "annad", password: randomUUID(), displayName: "Anna D" },
      { username: "mathias", password: randomUUID() },
    ],
    { name: "Anna D and Mathias's kitchen", kids: [], language: "en" },
  );

  expect(await addStarterRecipesOnce(app.database, kitchenId, "en", annaKitchenExtras)).toBe(true);
  const titles = (await app.query<{ title: string }>("select title from recipes where kitchen_id = $1 order by title", [kitchenId])).map((row) => row.title);
  expect(titles).toHaveLength(20);
  expect(titles).toContain("Lytkens lasagne");
  expect(titles).toContain("Rugbrødsmadder med æg og rejer");

  expect(await addStarterRecipesOnce(app.database, kitchenId, "en", annaKitchenExtras)).toBe(false);
  expect(await app.query("select id from recipes where kitchen_id = $1", [kitchenId])).toHaveLength(20);
});
