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

test("quick taps on people all count, stickers fit, and mashing needs a dinner", async ({ page }) => {
  const veg = `Big vegetable tray bake ${Date.now()}`;
  await page.goto("/");
  await page.getByLabel("Name").fill("ronja");
  await page.getByLabel("Password").fill(e2ePasswords.ronja);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "Hi Ronja" })).toBeVisible();
  const made = await page.request.post("/api/recipes", { data: recipe(veg, ["Vegetables", "Vegetarian", "Chicken"], ["freezable", "kid-friendly"]) });
  expect(made.ok()).toBe(true);

  // Two weeks ahead, so this test never shares a day with the one above.
  await page.getByRole("button", { name: "Next week" }).click();
  await page.getByRole("button", { name: "Next week" }).click();
  const thursday = page.getByRole("listitem", { name: "Thursday" });
  const people = thursday.getByRole("group", { name: "People on Thursday" });
  await expect(people).toContainText("2");

  // Three taps in the same moment, before any answer comes back.
  const saved = page.waitForResponse((response) => response.request().method() === "PUT" && response.url().includes("/api/plan/days/"));
  await thursday.getByRole("button", { name: "One more person on Thursday" }).evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
    button.click();
  });
  await expect(people).toContainText("5");
  expect((await saved).request().postDataJSON()).toEqual({ people: 5 });
  await page.reload();
  await page.getByRole("button", { name: "Next week" }).click();
  await page.getByRole("button", { name: "Next week" }).click();
  await expect(people).toContainText("5");

  await thursday.getByRole("button", { name: /Runi Lee/ }).click();
  const sheet = page.getByRole("dialog", { name: "Runi Lee on Thursday" });
  await expect(sheet.getByRole("button", { name: "Same as dinner, mashed" })).toBeDisabled();
  await expect(sheet.getByText("Pick a dinner first")).toBeVisible();
  await sheet.getByRole("button", { name: "Close" }).click();

  await thursday.getByRole("button", { name: "+ Pick a dinner" }).click();
  const dinner = page.getByRole("dialog", { name: "Dinner for Thursday" });
  await dinner.getByLabel("Search recipes").fill(veg);
  await dinner.getByRole("button", { name: new RegExp(veg) }).click();
  await expect(thursday.getByText(veg)).toBeVisible();

  for (const width of [375, 393]) {
    await page.setViewportSize({ width, height: 800 });
    const overflow = await thursday.evaluate((card) => {
      const box = card.getBoundingClientRect();
      return [...card.querySelectorAll<HTMLElement>(".sticker")]
        .filter((sticker) => {
          const own = sticker.getBoundingClientRect();
          return sticker.scrollWidth > sticker.clientWidth + 1 || own.right > box.right || own.left < box.left;
        })
        .map((sticker) => sticker.textContent);
    });
    expect(overflow, `stickers that spill at ${width}px`).toEqual([]);
  }
  await page.setViewportSize({ width: 375, height: 800 });
  await thursday.screenshot({ path: process.env.STICKER_SHOT ?? "test-results/week-stickers.png" });
});
