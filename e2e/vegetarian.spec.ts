import { expect, test, type Page } from "@playwright/test";
import { e2ePasswords } from "./passwords.ts";

const recipe = (title: string, types: string[], ageFromMonths: number | null = null) => ({
  title,
  feeds: 4,
  types,
  tags: [],
  ageFromMonths,
  ageToMonths: null,
  lines: [{ amount: 500, unit: "g", ingredient: "Chicken thighs", note: "" }],
  steps: ["Cook it."],
});

async function logIn(page: Page) {
  await page.goto("/");
  await page.getByLabel("Name").fill("peyton");
  await page.getByLabel("Password").fill(e2ePasswords.peyton);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
}

async function make(page: Page, data: ReturnType<typeof recipe>) {
  const made = await page.request.post("/api/recipes", { data });
  return ((await made.json()) as { id: string }).id;
}

test("Make vegetarian shows only on grown-up meat recipes", async ({ page }) => {
  await logIn(page);
  const stamp = Date.now();
  const veggie = await make(page, recipe(`Dal ${stamp}`, ["Vegetarian"]));
  const child = await make(page, recipe(`Baby chicken ${stamp}`, ["Chicken"], 8));

  for (const id of [veggie, child]) {
    await page.goto(`/#/recipes/${id}`);
    await expect(page.getByRole("link", { name: "Edit" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Make vegetarian" })).toHaveCount(0);
  }
});

// The server runs with PHOTO_RECIPE_FAKE (e2e/serve.ts), so any rewrite "comes back" as Granny's pancakes.
test("Make vegetarian: pick what goes in place of the meat, check the new version and save it; the original stays", async ({ page }) => {
  await logIn(page);
  const title = `Golden curry ${Date.now()}`;
  const curry = await make(page, recipe(title, ["Chicken"]));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/#/recipes/${curry}`);
  await page.screenshot({ path: "test-results/vegetarian-button.png" });
  await page.getByRole("button", { name: "Make vegetarian" }).click();
  const sheet = page.getByRole("dialog", { name: "Make vegetarian" });
  await expect(sheet.getByText("Replace the meat with…")).toBeVisible();
  await expect(sheet.getByLabel("Tofu")).toBeChecked();
  await sheet.getByLabel("Something else").check();
  await sheet.getByLabel("What to use instead").fill("chickpeas");
  await page.screenshot({ path: "test-results/vegetarian-sheet.png" });
  await sheet.getByRole("button", { name: "Make it" }).click();

  await expect(page.getByRole("heading", { name: "Check the recipe" })).toBeVisible();
  await expect(page.getByText("The vegetarian version.")).toBeVisible();
  await expect(page.getByLabel("Name")).toHaveValue("Granny's pancakes");
  await expect(page.getByLabel("Keep the recipe pages as gallery photos")).toHaveCount(0);
  await expect(page.getByRole("img", { name: "New main photo" })).toHaveCount(0);

  const newTitle = `${title} with chickpeas`;
  await page.getByLabel("Name").fill(newTitle);
  await page.getByRole("button", { name: "Save recipe" }).click();
  await expect(page.getByRole("heading", { name: newTitle })).toBeVisible();
  expect(page.url()).not.toContain(curry);

  const original = await (await page.request.get(`/api/recipes/${curry}`)).json();
  expect(original.title).toBe(title);
  expect(original.types).toEqual(["Chicken"]);
});
