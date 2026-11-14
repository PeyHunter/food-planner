import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { e2ePasswords } from "./passwords.ts";

const photo = async (name: string, colour: string) => ({
  name,
  mimeType: "image/jpeg",
  buffer: await sharp({ create: { width: 2400, height: 1800, channels: 3, background: colour } }).jpeg().toBuffer(),
});

async function logIn(page: Page) {
  await page.goto("/");
  await page.getByLabel("Name").fill("peyton");
  await page.getByLabel("Password").fill(e2ePasswords.peyton);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Recipes" }).click();
  await expect(page.getByRole("heading", { name: "Recipes", level: 2 })).toBeVisible();
}

const shownImage = (page: Page, name: string) =>
  expect.poll(() => page.getByRole("img", { name, exact: true }).first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0);

test("add a recipe with a photo, step 4 to 6 people, then log that I made it", async ({ page }) => {
  const title = `Fish pie ${Date.now()}`;
  await logIn(page);

  await page.getByRole("link", { name: "+ Add recipe" }).click();
  await page.getByLabel("Name").fill(title);
  await expect(page.getByLabel("Feeds (people)")).toHaveValue("4");
  await page.getByRole("button", { name: "Fish" }).click();
  await page.getByRole("button", { name: "kid-friendly" }).click();

  const lines = [
    ["3", "pcs", "Onion", "finely chopped"],
    ["130", "g", "Butter", ""],
    ["1", "tsp", "Salt", ""],
  ];
  for (const [index, [amount, unit, ingredient, note]] of lines.entries()) {
    const n = index + 1;
    if (n > 1) await page.getByRole("button", { name: "+ Add ingredient" }).click();
    await page.getByLabel(`Amount ${n}`).fill(amount!);
    await page.getByLabel(`Unit ${n}`).selectOption(unit!);
    await page.getByLabel(`Ingredient ${n}`).fill(ingredient!);
    if (note) await page.getByLabel(`Note ${n}`).fill(note);
  }
  await page.getByLabel("Step 1").fill("Fry the onion in the butter.");
  await page.getByLabel("Main photo").setInputFiles(await photo("pie.jpg", "#e8a33c"));
  await page.getByRole("button", { name: "Save recipe" }).click();

  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await shownImage(page, title);
  const amounts = page.locator(".lines .amount");
  await expect(amounts).toHaveText(["3 pcs", "130 g", "1 tsp"]);
  await expect(page.locator(".lines")).toContainText("Onion, finely chopped");

  await page.getByRole("button", { name: "More people" }).click();
  await page.getByRole("button", { name: "More people" }).click();
  await expect(page.getByText("Feeds 6")).toBeVisible();
  // 4.5 onions → 5, 195 g → 200 g, 1.5 tsp stays 1½
  await expect(amounts).toHaveText(["5 pcs", "200 g", "1½ tsp"]);
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT, fullPage: true });

  await page.getByRole("button", { name: "I made this" }).click();
  await page.getByLabel("Photos from this time (if you like)").setInputFiles([await photo("cook.jpg", "#3c8ee8")]);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(/^Made once, last on /)).toBeVisible();
  await expect(page.locator(".cooks li")).toHaveText([/by Peyton \(1 photo\)$/]);
  await shownImage(page, "Recipe photo");
  await expect(page.getByText("Feeds 6")).toBeVisible();

  await page.reload();
  await expect(page.getByText("Feeds 4")).toBeVisible();
  await expect(page.getByText(/^Made once/)).toBeVisible();

  await page.getByRole("link", { name: "Back to recipes" }).click();
  await page.getByLabel("Search recipes").fill("butter");
  await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible();
  await page.getByLabel("Search recipes").fill("no such dish");
  await expect(page.getByText('No recipe matches "no such dish".')).toBeVisible();
});

test("typing an ingredient suggests ones the kitchen already has", async ({ page, request }) => {
  await logIn(page);
  const made = await page.request.post("/api/recipes", {
    data: { title: "Carrot soup", feeds: 2, types: ["Vegetables"], tags: [], lines: [{ amount: 500, unit: "g", ingredient: "Carrots", note: "" }], steps: [] },
  });
  expect(made.status()).toBe(201);
  expect((await request.get("/api/ingredients?q=car")).status()).toBe(401);

  await page.getByRole("link", { name: "+ Add recipe" }).click();
  await page.getByLabel("Ingredient 1").fill("carr");
  await page.getByRole("list", { name: "Suggestions for ingredient 1" }).getByRole("button", { name: "Carrots" }).click();
  await expect(page.getByLabel("Ingredient 1")).toHaveValue("Carrots");
  await expect(page.getByRole("list", { name: "Suggestions for ingredient 1" })).toBeHidden();
});
