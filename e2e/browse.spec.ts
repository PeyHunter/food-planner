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
  await expect(first.getByText("freez-able!")).toBeVisible();
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
  // Past the last page the book goes round to page 1, and back again from page 1 to the last page.
  await page.getByRole("button", { name: "Back to page 1" }).click();
  await expect(first).toHaveAttribute("aria-current", "true");
  await expect(page.getByRole("status").filter({ hasText: "page 1 of 2" })).toBeAttached();
  await page.getByRole("button", { name: "Go to the last page" }).click();
  await expect(second).toHaveAttribute("aria-current", "true");

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
  await expect(page.getByRole("status").filter({ hasText: "Added to Wednesday" })).toHaveText("Added to Wednesday next week");

  await page.getByRole("button", { name: "Add to week" }).click();
  await expect(sheet.getByRole("region", { name: "Next week" }).getByRole("button", { name: /^Wednesday/ })).toContainText(cod);
  await sheet.getByRole("button", { name: "Close" }).click();

  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Week" }).click();
  await page.getByRole("button", { name: "Next week" }).click();
  await expect(page.getByRole("listitem", { name: "Wednesday" }).getByText(cod)).toBeVisible();
});

test("the list view with search is one tap away", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Name").fill("peyton");
  await page.getByLabel("Password").fill(e2ePasswords.peyton);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Recipes" }).click();
  await page.getByRole("link", { name: "List and search" }).click();
  await expect(page.getByLabel("Search recipes")).toBeVisible();
  await page.getByRole("link", { name: "Book" }).click();
  await expect(page.getByRole("heading", { name: "Flip through the book", level: 2 })).toBeVisible();
  await expect(page.getByRole("link", { name: "+ Add recipe" })).toBeVisible();
});
