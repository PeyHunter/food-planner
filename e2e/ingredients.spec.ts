import { expect, test } from "@playwright/test";
import { e2ePasswords } from "./passwords.ts";

test("set an ingredient's shop section, pack size and always-at-home from the Recipes tab", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Name").fill("peyton");
  await page.getByLabel("Password").fill(e2ePasswords.peyton);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Recipes" }).click();
  const tag = Date.now();
  const made = await page.request.post("/api/recipes", {
    data: {
      title: `Rice bowl ${tag}`,
      feeds: 2,
      types: ["Vegetarian"],
      tags: [],
      lines: [
        { amount: 300, unit: "g", ingredient: `Rice ${tag}`, note: "" },
        { amount: 15, unit: "ml", ingredient: `Oil ${tag}`, note: "" },
      ],
      steps: [],
    },
  });
  expect(made.status()).toBe(201);

  await page.getByRole("link", { name: "List and search" }).click();
  await page.getByRole("link", { name: "Ingredients" }).click();
  await expect(page.getByRole("heading", { name: "Ingredients", level: 2 })).toBeVisible();
  await page.getByLabel("Search ingredients").fill(`rice ${tag}`);
  await expect(page.getByRole("button", { name: /^Edit / })).toHaveCount(1);

  await page.getByRole("button", { name: `Edit Rice ${tag}` }).click();
  const form = page.getByRole("form", { name: `Settings for Rice ${tag}` });
  // Rice is guessed as Dry goods when it is first added; the user can still change it.
  await expect(form.getByLabel("Shop section")).toHaveValue("Dry goods");
  await expect(form).toContainText("Used in 1 recipe, so it can't be deleted.");
  await form.getByLabel("Shop section").selectOption("Frozen");
  await form.getByLabel("Pack amount").fill("1");
  await form.getByLabel("Pack unit").selectOption("kg");
  await form.getByRole("button", { name: "Save" }).click();
  const rice = page.getByRole("button", { name: `Edit Rice ${tag}` });
  await expect(rice).toContainText("Frozen");
  await expect(rice).toContainText("Pack 1 kg");

  await page.getByLabel("Search ingredients").fill(`oil ${tag}`);
  await page.getByRole("button", { name: `Edit Oil ${tag}` }).click();
  await page.getByLabel("Always at home (never on the shopping list)").check();
  await page.getByLabel("Pack amount").fill("lots");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("alert")).toHaveText("The pack size must be a number above 0.");
  await page.getByLabel("Pack amount").fill("");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: `Edit Oil ${tag}` })).toContainText("Always at home");
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT, fullPage: true });

  await page.reload();
  await page.getByLabel("Search ingredients").fill(String(tag));
  await expect(page.getByRole("button", { name: /^Edit / })).toHaveText([/Oil .*Spices & sauces.*Always at home/, /Rice .*Frozen.*Pack 1 kg/]);

  // Once no recipe uses it, an ingredient can be deleted.
  expect((await page.request.delete(`/api/recipes/${((await made.json()) as { id: string }).id}`)).status()).toBe(204);
  await page.reload();
  await page.getByLabel("Search ingredients").fill(String(tag));
  await page.getByRole("button", { name: `Edit Oil ${tag}` }).click();
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: `Delete Oil ${tag}` }).click();
  await expect(page.getByRole("button", { name: /^Edit / })).toHaveText([/Rice /]);

  await page.getByRole("link", { name: "Back to recipes" }).click();
  await expect(page.getByRole("heading", { name: "Recipes", level: 2 })).toBeVisible();
});
