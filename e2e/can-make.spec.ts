import { expect, test } from "@playwright/test";
import { e2ePasswords } from "./passwords.ts";

// The server runs with PHOTO_RECIPE_FAKE (e2e/serve.ts): the web search always suggests the same two Valdemarsro dishes.
test("what can I make: type what is at home, see recipes found on the web, and open one or save it", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Name").fill("peyton");
  await page.getByLabel("Password").fill(e2ePasswords.peyton);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
  await page.goto("/#/recipes/can-make");

  await expect(page.getByRole("heading", { name: "What can I make?" })).toBeVisible();
  await page.getByLabel("Ingredient you have").fill("potatoes");
  await page.getByRole("button", { name: "Add" }).click();
  await page.getByRole("button", { name: "Find recipes online" }).click();

  const first = page.locator(".can-make-idea").filter({ hasText: "Kartoffelpandekager" });
  await expect(first).toBeVisible();
  await expect(first.getByText("Valdemarsro", { exact: true })).toBeVisible();
  await expect(first.getByText("Missing: Eggs")).toBeVisible();
  await expect(first.getByRole("link", { name: "Open" })).toHaveAttribute("href", "https://valdemarsro.dk/kartoffelpandekager/");
  await expect(first.getByRole("link", { name: "Open" })).toHaveAttribute("target", "_blank");
  await expect(first.getByRole("link", { name: "Save to my recipes" })).toHaveAttribute(
    "href",
    `#/recipes/from-link?url=${encodeURIComponent("https://valdemarsro.dk/kartoffelpandekager/")}`,
  );
  await expect(page.getByRole("link", { name: "Open" })).toHaveCount(2);
});
