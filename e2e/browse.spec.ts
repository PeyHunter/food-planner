import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { e2ePasswords } from "./passwords.ts";

const recipe = (title: string, types: string[], tags: string[]) => ({ title, feeds: 4, types, tags, ageFromMonths: null, ageToMonths: null, lines: [], steps: [] });

test("flip through the book, filter to Fish, swipe, and add a dish to Wednesday", async ({ page }) => {
  const stamp = Date.now();
  const tag = `tray ${stamp}`;
  const salmon = `A salmon tray ${stamp}`;
  const cod = `B cod tray ${stamp}`;

  await page.goto("/");
  await page.getByLabel("Name").fill("peyton");
  await page.getByLabel("Password").fill(e2ePasswords.peyton);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();

  const made = await page.request.post("/api/recipes", { data: recipe(salmon, ["Fish"], ["freezable", tag]) });
  const { id } = (await made.json()) as { id: string };
  const jpeg = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#f08a5d" } }).jpeg().toBuffer();
  await page.request.post(`/api/recipes/${id}/photos`, { multipart: { role: "main", photo: { name: "salmon.jpg", mimeType: "image/jpeg", buffer: jpeg } } });
  await page.request.post(`/api/recipes/${id}/cooks`, { multipart: { madeOn: "2026-11-01" } });
  await page.request.post("/api/recipes", { data: recipe(cod, ["Fish"], [tag]) });
  await page.request.post("/api/recipes", { data: recipe(`C beef tray ${stamp}`, ["Meat"], [tag]) });

  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Recipes" }).click();
  await page.getByRole("button", { name: "Book", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Flip through the book", level: 2 })).toBeVisible();

  const filters = page.getByRole("group", { name: "Filter recipes" });
  const pages = page.getByRole("list", { name: "Recipe pages" });
  await filters.getByRole("button", { name: tag }).click();
  await expect(pages.getByRole("listitem")).toHaveCount(3);
  await expect(page.getByText("p. 1 / 3")).toBeVisible();

  await filters.getByRole("button", { name: "Fish", exact: true }).click();
  await expect(pages.getByRole("listitem")).toHaveCount(2);
  const first = pages.getByRole("listitem", { name: `${salmon}, page 1 of 2` });
  await expect(first).toHaveAttribute("aria-current", "true");
  await expect(first.getByText("p. 1 / 2")).toBeVisible();
  await expect(first.getByText("Made 1×")).toBeVisible();
  await expect(first.getByText(/^freez-\s*able!$/)).toBeVisible();
  await filters.evaluate((element) => {
    element.scrollTo(0, 0);
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
  });
  await page.screenshot({ path: process.env.BROWSE_SHOT ?? "test-results/browse.png" });

  // A real finger swipe to the left turns the page.
  const box = (await pages.boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const y = Math.round(box.y + 100);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: Math.round(box.x + box.width * 0.85), y }] });
  for (let step = 1; step <= 20; step++) {
    const x = Math.round(box.x + box.width * (0.85 - step * 0.035));
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  const second = pages.getByRole("listitem", { name: `${cod}, page 2 of 2` });
  await expect(second).toHaveAttribute("aria-current", "true");
  await expect(page.getByRole("button", { name: "Next page" })).toBeDisabled();

  await page.getByRole("button", { name: "Previous page" }).click();
  await expect(first).toHaveAttribute("aria-current", "true");
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(second).toHaveAttribute("aria-current", "true");

  // Tapping the page opens the recipe; coming back lands on the same page.
  await second.getByRole("link", { name: cod }).click();
  await expect(page.getByRole("heading", { name: cod, level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "Back to recipes" }).click();
  await expect(second).toHaveAttribute("aria-current", "true");

  await page.getByRole("button", { name: "Add to week" }).click();
  const sheet = page.getByRole("dialog", { name: `Add ${cod} to the week` });
  const wednesday = sheet.getByRole("region", { name: "Next week" }).getByRole("button", { name: /^Wednesday/ });
  await wednesday.click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText("Added to")).toHaveCount(0);

  await page.getByRole("button", { name: "Add to week" }).click();
  await expect(sheet.getByRole("region", { name: "Next week" }).getByRole("button", { name: /^Wednesday/ })).toContainText(cod);
  await sheet.getByRole("button", { name: "Close" }).click();

  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Week" }).click();
  await page.getByRole("button", { name: "Next week" }).click();
  await expect(page.getByRole("listitem", { name: "Wednesday" }).getByText(cod)).toBeVisible();
});

test("the grid with search is the default, and the book is one tap away", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Name").fill("peyton");
  await page.getByLabel("Password").fill(e2ePasswords.peyton);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Recipes" }).click();
  await expect(page.getByLabel("Search recipes")).toBeVisible();
  await expect(page.getByRole("button", { name: "Grid", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: "+ Add recipe" })).toBeVisible();

  await page.getByRole("button", { name: "Book", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Flip through the book", level: 2 })).toBeVisible();
  await expect(page.getByRole("link", { name: "+ Add recipe" })).toBeVisible();
  await page.getByRole("button", { name: "Grid", exact: true }).click();
  await expect(page.getByLabel("Search recipes")).toBeVisible();
});

test("each time the app is opened the book starts on a different recipe", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Name").fill("peyton");
  await page.getByLabel("Password").fill(e2ePasswords.peyton);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
  const stamp = Date.now();
  await page.request.post("/api/recipes", { data: recipe(`First pick one ${stamp}`, ["Meat"], []) });
  await page.request.post("/api/recipes", { data: recipe(`First pick two ${stamp}`, ["Fish"], []) });

  const firstPage = async () => {
    await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Recipes" }).click();
    await page.getByRole("button", { name: "Book", exact: true }).click();
    const open = page.getByRole("list", { name: "Recipe pages" }).locator("li[aria-current='true']");
    await expect(open).toHaveCount(1);
    return open.getAttribute("aria-label");
  };

  const before = await firstPage();
  await page.reload();
  const after = await firstPage();
  expect(after).not.toBe(before);
});

test("the grid is the default and the book choice is remembered", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Name").fill("peyton");
  await page.getByLabel("Password").fill(e2ePasswords.peyton);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByLabel("Search recipes")).toBeVisible();

  await page.getByRole("button", { name: "Book", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Flip through the book", level: 2 })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Flip through the book", level: 2 })).toBeVisible();

  await page.getByRole("button", { name: "Grid", exact: true }).click();
  await expect(page.getByLabel("Search recipes")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Search recipes")).toBeVisible();
});

test("the header row stays on one line at iPhone SE width, in both views", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");
  await page.getByLabel("Name").fill("peyton");
  await page.getByLabel("Password").fill(e2ePasswords.peyton);
  await page.getByRole("button", { name: "Log in" }).click();

  const lineOf = async (selector: string) => {
    const tops = await page.locator(`${selector} a, ${selector} button`).evaluateAll((elements) => elements.map((element) => Math.round(element.getBoundingClientRect().top)));
    expect(tops.length).toBeGreaterThan(0);
    expect(new Set(tops).size).toBe(1);
  };
  const noSideScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

  const row = page.locator(".home-actions");
  await expect(row.getByRole("link")).toHaveCount(3);
  await expect(row.getByRole("link", { name: "What can I make?" })).toBeVisible();
  await expect(row.getByRole("link", { name: "❄ Freezer" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Plan the week" })).toHaveCount(0);
  await lineOf(".home-actions");
  expect(await noSideScroll()).toBe(true);
  await row.getByRole("link", { name: "+ Add recipe" }).click();
  await expect(page.getByRole("heading", { name: "New recipe", level: 2 })).toBeVisible();

  await page.goto("/#/home");
  await page.getByRole("button", { name: "Book", exact: true }).click();
  await lineOf(".home-actions");
  await expect(row.getByRole("link", { name: "+ Add recipe" })).toBeVisible();
  await lineOf(".home-links");
  expect(await noSideScroll()).toBe(true);
});

test("recipe cards keep their text and stickers inside the card at 320 and 430 px", async ({ page }) => {
  const stamp = Date.now();
  await page.request.post("/api/recipes", { data: recipe(`An extremely long recipe name that wraps over and over ${stamp} with no spaces Lasagnaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`, ["Vegetables", "Chicken"], []) });
  await page.request.post("/api/recipes", { data: recipe(`Short ${stamp}`, ["Fish"], []) });
  await page.goto("/");
  await page.getByLabel("Name").fill("peyton");
  await page.getByLabel("Password").fill(e2ePasswords.peyton);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Recipes" }).click();
  await expect(page.getByRole("link", { name: new RegExp(`Short ${stamp}`) })).toBeVisible();

  for (const width of [320, 430]) {
    await page.setViewportSize({ width, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const fits = await page.locator(".recipe-card").evaluateAll((cards) =>
      cards.map((card) => {
        const box = card.getBoundingClientRect();
        const inside = [...card.querySelectorAll("*")].every((element) => {
          const rect = element.getBoundingClientRect();
          return rect.left >= box.left - 0.5 && rect.right <= box.right + 0.5;
        });
        return inside && card.scrollWidth <= card.clientWidth + 1;
      }),
    );
    expect(fits.length).toBeGreaterThan(1);
    expect(fits.every(Boolean)).toBe(true);
  }
});
