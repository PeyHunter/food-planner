import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { e2ePasswords } from "./passwords.ts";

const recipe = (title: string, types: string[], tags: string[]) => ({ title, feeds: 4, types, tags, ageFromMonths: null, ageToMonths: null, lines: [], steps: [] });

test("plan a fish dinner, set Wednesday to 5, mash it for Runi and take a swap", async ({ page }) => {
  const stamp = Date.now();
  const salmon = `Salmon bake ${stamp}`;
  const mash = `Cod mash ${stamp}`;

  await page.goto("/");
  await page.getByLabel("Name").fill("peyton");
  await page.getByLabel("Password").fill(e2ePasswords.peyton);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Week" })).toHaveAttribute("aria-current", "page");

  // Recipes come in through the API; adding them in the form is covered by recipe.spec.ts.
  const made = await page.request.post("/api/recipes", { data: recipe(salmon, ["Fish"], ["freezable"]) });
  const { id } = (await made.json()) as { id: string };
  const jpeg = await sharp({ create: { width: 600, height: 600, channels: 3, background: "#f08a5d" } }).jpeg().toBuffer();
  await page.request.post(`/api/recipes/${id}/photos`, { multipart: { role: "main", photo: { name: "salmon.jpg", mimeType: "image/jpeg", buffer: jpeg } } });
  await page.request.post("/api/recipes", { data: recipe(mash, ["Fish"], ["for Runi"]) });

  // This week has a "next up" day; plan next week so no day is in the past.
  await expect(page.getByText("Next up")).toBeVisible();
  await page.getByRole("button", { name: "Next week" }).click();
  await expect(page.getByText("Next up")).toBeHidden();

  const wednesday = page.getByRole("listitem", { name: "Wednesday" });
  await wednesday.getByRole("button", { name: "+ Pick a dinner" }).click();
  const sheet = page.getByRole("dialog", { name: "Dinner for Wednesday" });
  await sheet.getByLabel("Search recipes").fill(salmon);
  await sheet.getByRole("button", { name: new RegExp(salmon) }).click();
  await expect(sheet).toBeHidden();
  await expect(wednesday.getByText(salmon)).toBeVisible();
  await expect(page.getByLabel("Adults: Fish at least 1 a week: 1 so far, met")).toBeVisible();

  for (let step = 0; step < 3; step++) await wednesday.getByRole("button", { name: "One more person on Wednesday" }).click();
  await expect(wednesday.getByRole("group", { name: "People on Wednesday" })).toContainText("5");

  await wednesday.getByRole("button", { name: /Runi Lee/ }).click();
  await page.getByRole("dialog", { name: "Runi Lee on Wednesday" }).getByRole("button", { name: "Same as dinner, mashed" }).click();
  await expect(wednesday.getByRole("button", { name: /Runi Lee/ })).toContainText("Same as dinner, mashed");
  await expect(wednesday.getByRole("group", { name: "People on Wednesday" })).toContainText("+½");
  await expect(page.getByLabel("Runi Lee: Fish at least 2 a week: 1 so far, not met yet")).toBeVisible();

  const swap = page.getByRole("button", { name: /^Do it: Add .* on Runi Lee's Monday to get fish 2\/2$/ });
  await swap.click();
  await expect(page.getByLabel("Runi Lee: Fish at least 2 a week: 2 so far, met")).toBeVisible();

  await page.getByRole("button", { name: "Edit rules" }).click();
  const rules = page.getByRole("dialog", { name: "Edit rules" });
  await rules.getByRole("button", { name: "+ Add a rule" }).click();
  // A new rule starts as the adults' third rule: "Adults: Fish at least 1 a week".
  await expect(rules.getByRole("listitem")).toHaveCount(6);
  await rules.getByLabel("What 3").selectOption("Chicken");
  await rules.getByLabel("At least or at most 3").selectOption("at-most");
  await rules.getByLabel("Who 3").selectOption({ label: "Runi Lee" });
  await expect(rules.getByRole("button", { name: "Remove rule: Runi Lee: Chicken at most 1 a week" })).toBeVisible();
  await rules.getByRole("button", { name: "Close" }).click();
  await expect(page.getByLabel("Runi Lee: Chicken at most 1 a week: 0 so far, met")).toBeVisible();

  await page.getByRole("button", { name: "Edit rules" }).click();
  await rules.getByRole("button", { name: "Remove rule: Runi Lee: Chicken at most 1 a week" }).click();
  await rules.getByRole("button", { name: "Close" }).click();
  await expect(page.getByLabel(/Chicken/)).toHaveCount(0);

  await page.reload();
  await page.getByRole("button", { name: "Next week" }).click();
  await expect(page.getByRole("listitem", { name: "Wednesday" }).getByText(salmon)).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: process.env.WEEK_SHOT ?? "test-results/week.png", fullPage: true });
});
