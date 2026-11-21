import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { addDays, mondayOf } from "../src/shared/week.ts";
import { e2ePasswords } from "./passwords.ts";

// No screenshots here: in WebKit, Playwright's screenshot adds its own <style>, which the policy refuses too.

/** Collects every console message where the Content-Security-Policy refused something. */
function watchPolicy(page: Page) {
  const refused: string[] = [];
  page.on("console", (message) => {
    const text = message.text();
    if (/Content Security Policy|Refused to/i.test(text)) refused.push(`${page.url()}: ${text}`);
  });
  return refused;
}

/** A full load: WebKit treats a hash-only goto as same-page. */
async function open(page: Page, hash: string) {
  await page.goto("about:blank");
  await page.goto(`/${hash}`);
}

test("no screen breaks the Content-Security-Policy", async ({ page, browser }) => {
  // The share sheet stand-in, since the test browser has none.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: (data: ShareData) => ((window as unknown as { shared: ShareData }).shared = data, Promise.resolve()) });
  });
  const refused = watchPolicy(page);

  await page.goto("/");
  await expect(page.getByLabel("Password")).toBeVisible();
  await page.getByLabel("Name").fill("peyton");
  await page.getByLabel("Password").fill(e2ePasswords.peyton);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Hi Peyton" })).toBeVisible();

  // Every tab in the bar, the kids tab included (its name is the child's).
  const nav = page.getByRole("navigation", { name: "Main" });
  const tabs = await nav.getByRole("button").count();
  expect(tabs).toBeGreaterThanOrEqual(4);
  for (let i = 0; i < tabs; i++) {
    await nav.getByRole("button").nth(i).click();
    await page.waitForLoadState("networkidle");
  }

  for (const hash of ["#/recipes/list", "#/recipes/freezer", "#/recipes/ingredients", "#/recipes/new", "#/recipes/from-link", "#/recipes/from-photo", "#/profile"]) {
    await open(page, hash);
    await page.waitForLoadState("networkidle");
  }

  // The dinner sheet, on a week far ahead so it touches no other test's days.
  await open(page, `#/week?monday=${addDays(mondayOf(new Date().toISOString().slice(0, 10)), 7 * 260)}`);
  const friday = page.getByRole("listitem", { name: "Friday" });
  await friday.getByRole("button", { name: "+ Pick a dinner" }).click();
  const sheet = page.getByRole("dialog", { name: "Dinner for Friday" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Close" }).click();

  // A recipe with a photo: its page, the photo viewer, then its share page, logged out.
  const made = await page.request.post("/api/recipes", {
    data: { title: `Policy pie ${Date.now()}`, feeds: 4, types: ["Fish"], tags: [], lines: [{ amount: 1, unit: "pcs", ingredient: "Onion", note: "" }], steps: ["Bake it."] },
  });
  const { id } = (await made.json()) as { id: string };
  const buffer = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#e8a33c" } }).jpeg().toBuffer();
  await page.request.post(`/api/recipes/${id}/photos`, { multipart: { role: "main", photo: { name: "pie.jpg", mimeType: "image/jpeg", buffer } } });
  await open(page, `#/recipes/${id}`);
  await page.getByRole("button", { name: "Open the photo" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Share link" }).click();
  await expect(page.getByRole("switch", { name: "Share link" })).toBeChecked();
  const shared = await page.evaluate(() => (window as unknown as { shared: ShareData }).shared);

  const stranger = await browser.newPage();
  const strangerRefused = watchPolicy(stranger);
  await stranger.goto(shared.url!);
  await stranger.getByRole("button", { name: "Open the photo" }).click();
  await expect(stranger.getByRole("dialog")).toBeVisible();
  await stranger.close();

  expect([...refused, ...strangerRefused]).toEqual([]);
});
