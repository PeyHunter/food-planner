import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { e2ePasswords } from "./passwords.ts";

async function logIn(page: Page) {
  await page.goto("/");
  await page.getByLabel("Name").fill("peyton");
  await page.getByLabel("Password").fill(e2ePasswords.peyton);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
}

const jpeg = (background: string) => sharp({ create: { width: 900, height: 1200, channels: 3, background } }).jpeg().toBuffer();

/** A recipe with a main photo and two gallery photos. */
async function addRecipe(page: Page, title: string) {
  const made = await page.request.post("/api/recipes", { data: { title, feeds: 2, types: ["Fish"], tags: [], lines: [], steps: ["Cook it."] } });
  const { id } = (await made.json()) as { id: string };
  for (const [role, colour] of [["main", "#e8a33c"], ["gallery", "#3c8ee8"], ["gallery", "#3ce87a"]] as const) {
    const photo = await page.request.post(`/api/recipes/${id}/photos`, { multipart: { role, photo: { name: `${colour.slice(1)}.jpg`, mimeType: "image/jpeg", buffer: await jpeg(colour) } } });
    expect(photo.status()).toBe(201);
  }
  return id;
}

test("photos open full-screen in the app: ← Back, ✕ and Escape close it, arrow keys move between photos", async ({ page }) => {
  await logIn(page);
  const id = await addRecipe(page, `Viewer fish ${Date.now()}`);
  await page.goto(`/#/recipes/${id}`);

  await page.getByRole("region", { name: "Photos" }).getByRole("button", { name: "Open photo 1" }).click();
  const viewer = page.getByRole("dialog");
  await expect(viewer).toBeVisible();
  await expect(viewer.getByRole("button", { name: "← Back" })).toBeVisible();
  await expect(viewer.getByText("1 / 3")).toBeVisible();
  await viewer.getByRole("button", { name: "Close" }).click();
  await expect(viewer).toHaveCount(0);

  await page.locator(".gallery").getByRole("button", { name: "Open photo 1" }).click();
  await expect(viewer.getByText("2 / 3")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(viewer.getByText("3 / 3")).toBeVisible();
  await expect(viewer.getByRole("button", { name: "Next photo" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);

  await page.locator(".gallery").getByRole("button", { name: "Open photo 2" }).click();
  await expect(viewer.getByText("3 / 3")).toBeVisible();
  await viewer.getByRole("button", { name: "← Back" }).click();
  await expect(viewer).toHaveCount(0);
  await expect(page.getByRole("button", { name: "I made this" })).toBeVisible();
});

test("the share page opens its photos in the same viewer", async ({ page, browser }) => {
  await logIn(page);
  const id = await addRecipe(page, `Shared viewer fish ${Date.now()}`);
  const { url } = (await (await page.request.post(`/api/recipes/${id}/share`)).json()) as { url: string };

  const stranger = await browser.newPage();
  await stranger.goto(url);
  await stranger.getByRole("button", { name: "Open photo 1" }).click();
  const viewer = stranger.getByRole("dialog");
  await expect(viewer.getByText("2 / 3")).toBeVisible();
  await expect(viewer.getByRole("button", { name: "← Back" })).toBeVisible();
  await stranger.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);
  await stranger.getByRole("button", { name: "Open the photo" }).click();
  await viewer.getByRole("button", { name: "Close" }).click();
  await expect(viewer).toHaveCount(0);
  await stranger.close();
});
