import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { e2ePasswords } from "./passwords.ts";

// Not a real test: CI runs it on its own with SHOTS_DIR set, to save phone screenshots for review.
const shotsDir = process.env.SHOTS_DIR;
test.skip(!shotsDir, "Only runs with SHOTS_DIR set (the CI screenshot step)");

const recipe = (title: string, feeds: number, types: string[], tags: string[]) => ({ title, feeds, types, tags, ageFromMonths: null, ageToMonths: null, lines: [], steps: [] });

test("capture the screens for review", async ({ page }) => {
  mkdirSync(shotsDir!, { recursive: true });
  const stamp = Date.now();
  const grownUp = `Slow-braised beef and red wine stew with buttery mash and green beans, a very long title ${stamp}`;
  const runi = `Runi pea and salmon mash ${stamp}`;
  let taken = 0;

  // Each shot is its own try/catch so one missing element does not stop the rest.
  async function shot(name: string, action: () => Promise<void>) {
    try {
      await action();
      await page.screenshot({ path: `${shotsDir}/${name}.png`, fullPage: true });
      taken++;
    } catch (error) {
      console.log(`Screenshot ${name} failed:`, error);
    }
  }

  async function seed(data: ReturnType<typeof recipe>, photo?: string) {
    try {
      const made = await page.request.post("/api/recipes", { data });
      const { id } = (await made.json()) as { id: string };
      if (photo) {
        const jpeg = await sharp({ create: { width: 800, height: 600, channels: 3, background: photo } }).jpeg().toBuffer();
        await page.request.post(`/api/recipes/${id}/photos`, { multipart: { role: "main", photo: { name: "dish.jpg", mimeType: "image/jpeg", buffer: jpeg } } });
      }
      return id;
    } catch (error) {
      console.log(`Seeding ${data.title} failed:`, error);
      return undefined;
    }
  }

  // Log in, then make the recipes the screens show.
  await page.goto("/");
  await page.getByLabel("Name").fill("peyton");
  await page.getByLabel("Password").fill(e2ePasswords.peyton);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();

  await seed(recipe(grownUp, 4, ["Meat", "Fish", "Vegetables"], [`grown ${stamp}`]), "#8a5a44");
  await seed(recipe(`Plain pasta ${stamp}`, 4, ["Vegetarian"], [`grown ${stamp}`]));
  const runiId = await seed(recipe(runi, 2, ["Fish", "Vegetables"], ["for Runi", "freezable"]), "#f08a5d");

  // 01: the recipes grid, at iPhone size and then at a narrow 320px width.
  await shot("01-recipes-grid", async () => {
    await page.goto("/#/recipes");
    await page.getByText(grownUp).first().waitFor({ timeout: 10_000 }).catch(() => console.log("Grid recipe title not found"));
  });

  // 02: the flip-through book.
  await shot("02-recipes-book", async () => {
    const book = page.getByRole("button", { name: /Book|Flip through/ }).first();
    if (await book.isVisible().catch(() => false)) {
      await book.click();
    } else {
      console.log("No Book button found, shooting the recipes tab instead");
      await page.goto("/#/recipes");
    }
  });

  await shot("03-what-can-i-make", async () => {
    await page.goto("/#/recipes/can-make");
  });

  await shot("04-freezer", async () => {
    await page.goto("/#/recipes/freezer");
  });

  // 05: the Runi recipe with "I made this" opened.
  await shot("05-runi-recipe-made-this", async () => {
    await page.goto(`/#/recipes/${runiId}`);
    await page.getByRole("button", { name: "I made this" }).click();
  });

  await shot("06-week", async () => {
    await page.goto("/#/week");
  });

  // 07: the Runi picker for a day, on next week so no day is in the past.
  await shot("07-week-runi-picker", async () => {
    await page.goto("/#/week");
    await page.getByRole("button", { name: "Next week" }).click();
    const wednesday = page.getByRole("listitem", { name: "Wednesday" });
    await wednesday.getByRole("button", { name: /Runi Lee/ }).click();
    await page.getByRole("dialog", { name: /Runi Lee on/ }).waitFor({ timeout: 10_000 });
  });

  await shot("08-kids", async () => {
    await page.goto("/#/kids");
  });

  // Same two screens again at 320px wide, to check nothing overflows.
  await page.setViewportSize({ width: 320, height: 640 });
  await shot("01-recipes-grid-320", async () => {
    // #/recipes/list always opens the grid; #/recipes would reopen the book saved by shot 02.
    await page.goto("/#/recipes/list");
    await page.getByText(grownUp).first().waitFor({ timeout: 10_000 }).catch(() => console.log("Grid recipe title not found"));
  });
  await shot("02-recipes-book-320", async () => {
    const book = page.getByRole("button", { name: /Book|Flip through/ }).first();
    if (await book.isVisible().catch(() => false)) {
      await book.click();
    } else {
      await page.goto("/#/recipes");
    }
  });

  // 08 at 320px: one portion put in first, so both the "Put one portion in" row and the − / + row show.
  await shot("08-kids-320", async () => {
    await page.goto("/#/kids");
    const put = page.getByRole("button", { name: "Put one portion in" }).first();
    if (await put.waitFor({ timeout: 10_000 }).then(() => true, () => false)) {
      await put.click();
      await page.getByRole("group", { name: /Portions of/ }).first().waitFor({ timeout: 10_000 }).catch(() => console.log("No − / + row after putting a portion in"));
    } else {
      console.log("No Put one portion in button on the Kids tab");
    }
  });

  expect(taken).toBeGreaterThan(0);
});
