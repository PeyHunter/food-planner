import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { e2ePasswords } from "./passwords.ts";

// The server runs with PHOTO_RECIPE_FAKE (e2e/serve.ts): any photo "reads" as Granny's pancakes.
test("photo to recipe: take a photo, check the draft in the edit form, save it with the dish picture as main photo and the page in the gallery", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Name").fill("peyton");
  await page.getByLabel("Password").fill(e2ePasswords.peyton);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
  await page.goto("/#/recipes/list");

  await page.getByRole("link", { name: "Photo to recipe" }).click();
  await expect(page.getByRole("heading", { name: "Photo to recipe" })).toBeVisible();
  const handwriting = await sharp({ create: { width: 2400, height: 3200, channels: 3, background: "#f4ecd8" } }).jpeg().toBuffer();
  await page.getByLabel("Take a photo").setInputFiles({ name: "recipe.jpg", mimeType: "image/jpeg", buffer: handwriting });
  await expect(page.getByRole("img", { name: "Recipe photo 1" })).toBeVisible();

  await page.getByRole("button", { name: "Read the recipe" }).click();
  await expect(page.getByRole("heading", { name: "Check the recipe" })).toBeVisible();
  await expect(page.getByLabel("Name")).toHaveValue("Granny's pancakes");
  await expect(page.getByLabel("Description")).toHaveValue("Thin pancakes like Granny made on Sundays.");
  await expect(page.getByRole("img", { name: "New main photo" })).toBeVisible();
  await expect(page.getByText("The dish picture from the book.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Vegetarian" })).toHaveAttribute("aria-pressed", "true");
  // 2 cups → 4.8 dl, the pinch moves into the note, the line with -1 g is left out with a note.
  await expect(page.getByLabel("Amount 1")).toHaveValue("4.8");
  await expect(page.getByLabel("Unit 1")).toHaveValue("dl");
  await expect(page.getByLabel("Ingredient 2")).toHaveValue("Egg");
  await expect(page.getByLabel("Note 3")).toHaveValue("1 pinch");
  await expect(page.getByLabel("Unit 3")).toHaveValue("");
  await expect(page.getByRole("list", { name: "Notes from reading" })).toContainText("Left out a line (Butter)");
  await expect(page.getByLabel("Step 2")).toHaveValue("Fry thin pancakes in butter.");

  const title = `Granny's pancakes ${Date.now()}`;
  await page.getByLabel("Name").fill(title);
  await expect(page.getByLabel("Keep the recipe pages as gallery photos")).toBeChecked();
  await page.getByRole("button", { name: "Save recipe" }).click();

  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.locator(".description")).toHaveText("Thin pancakes like Granny made on Sundays.");
  await expect(page.locator(".lines .amount")).toHaveText(["4.8 dl", "3 pcs", ""]);
  const recipeId = page.url().split("/").at(-1)!;
  const recipe = await (await page.request.get(`/api/recipes/${recipeId}`)).json();
  expect(recipe.photos.map((photo: { role: string }) => photo.role).sort()).toEqual(["gallery", "main"]);
  expect(recipe.mainPhoto).not.toBeNull();
});
