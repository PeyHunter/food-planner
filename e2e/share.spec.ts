import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { e2ePasswords } from "./passwords.ts";

async function logIn(page: Page) {
  await page.goto("/");
  await page.getByLabel("Name").fill("peyton");
  await page.getByLabel("Password").fill(e2ePasswords.peyton);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Recipes" }).click();
  await expect(page.getByRole("heading", { name: "Flip through the book", level: 2 })).toBeVisible();
}

async function addRecipe(page: Page, title: string) {
  const made = await page.request.post("/api/recipes", {
    data: {
      title,
      feeds: 4,
      types: ["Fish"],
      tags: ["kid-friendly"],
      lines: [
        { amount: 3, unit: "pcs", ingredient: "Onion", note: "finely chopped" },
        { amount: 130, unit: "g", ingredient: "Butter", note: "" },
      ],
      steps: ["Fry the onion in the butter."],
    },
  });
  const { id } = (await made.json()) as { id: string };
  const buffer = await sharp({ create: { width: 1200, height: 900, channels: 3, background: "#e8a33c" } }).jpeg().toBuffer();
  const photo = await page.request.post(`/api/recipes/${id}/photos`, { multipart: { role: "main", photo: { name: "pie.jpg", mimeType: "image/jpeg", buffer } } });
  expect(photo.status()).toBe(201);
  return id;
}

const shownImage = (page: Page, name: string) =>
  expect.poll(() => page.getByRole("img", { name, exact: true }).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0);

test("share a recipe, open it logged out with the stepper, then turn the link off", async ({ page, browser }) => {
  // Catch what the share sheet would get, since the test browser has none.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      value: (data: ShareData) => {
        (window as unknown as { shared: ShareData }).shared = data;
        return Promise.resolve();
      },
    });
  });
  const title = `Shared pie ${Date.now()}`;
  await logIn(page);
  const id = await addRecipe(page, title);
  await page.goto(`/#/recipes/${id}`);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  // The state comes with the recipe, so the switch is ready at once and says what it is.
  await expect(page.getByRole("switch", { name: "Share link" })).not.toBeChecked();
  await expect(page.getByRole("switch", { name: "Share link" })).toBeEnabled();
  await expect(page.getByText("Share link is off")).toBeVisible();

  await page.getByRole("button", { name: "Share link" }).click();
  await expect(page.getByRole("switch", { name: "Share link" })).toBeChecked();
  await expect(page.getByText("Share link is on")).toBeVisible();
  const shared = await page.evaluate(() => (window as unknown as { shared: ShareData }).shared);
  expect(shared.title).toBe(title);
  expect(shared.url).toMatch(/\/s\/[A-Za-z0-9_-]{43}$/);

  // A stranger with no login.
  const stranger = await browser.newPage();
  const opened = await stranger.goto(shared.url!);
  expect(opened?.status()).toBe(200);
  await expect(stranger.getByRole("heading", { name: title })).toBeVisible();
  await shownImage(stranger, title);
  // A phone gets the 800 px copy, not the full photo.
  expect(await stranger.getByRole("img", { name: title, exact: true }).evaluate((img: HTMLImageElement) => [img.currentSrc.endsWith("-800.jpg"), img.naturalWidth])).toEqual([true, 800]);
  await expect(stranger.getByRole("button", { name: "Log in" })).toHaveCount(0);
  await expect(stranger.getByText("Fry the onion in the butter.")).toBeVisible();
  const amounts = stranger.locator(".lines .amount");
  await expect(amounts).toHaveText(["3 pcs", "130 g"]);
  await stranger.getByRole("button", { name: "More people" }).click();
  await stranger.getByRole("button", { name: "More people" }).click();
  await expect(stranger.getByText("Feeds 6")).toBeVisible();
  await expect(amounts).toHaveText(["5 pcs", "200 g"]);
  if (process.env.SHOT) await stranger.screenshot({ path: process.env.SHOT, fullPage: true });

  await page.getByRole("switch", { name: "Share link" }).click();
  await expect(page.getByRole("switch", { name: "Share link" })).not.toBeChecked();
  await expect(page.getByText("Share link is off")).toBeVisible();
  await expect(page.locator(".share-note")).toHaveText("Link turned off");

  const gone = await stranger.reload();
  expect(gone?.status()).toBe(404);
  await expect(stranger.getByRole("heading", { name: "This link doesn't work" })).toBeVisible();
  await expect(stranger.getByText(title)).toHaveCount(0);
  await stranger.close();
});

test("without a share sheet the link is copied", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: undefined });
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: (text: string) => {
          (window as unknown as { copied: string }).copied = text;
          return Promise.resolve();
        },
      },
    });
  });
  await logIn(page);
  const id = await addRecipe(page, `Copied pie ${Date.now()}`);
  await page.goto(`/#/recipes/${id}`);
  await page.getByRole("button", { name: "Share link" }).click();
  await expect(page.locator(".share-note")).toHaveText("Link copied");
  const copied = await page.evaluate(() => (window as unknown as { copied: string }).copied);
  expect(copied).toMatch(/\/s\/[A-Za-z0-9_-]{43}$/);
  await expect(page.getByRole("textbox", { name: "The share link" })).toHaveValue(copied);
});
