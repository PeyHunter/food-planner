import { expect, test, type Page } from "@playwright/test";
import { addDays, mondayOf } from "../src/shared/week.ts";
import { e2ePasswords } from "./passwords.ts";

/** Opens the week of this Monday. A full load: WebKit treats a hash-only goto as same-page, so the week would not change. */
async function openWeek(page: Page, monday: string) {
  await page.goto("about:blank");
  await page.goto(`/#/week?monday=${monday}`);
}

// Safari (the iphone-webkit project) is where these went wrong: a ring round Close on every open,
// and the page behind scrolled while the sheet was open, so it came back somewhere else.
test("a sheet opens without a ring round Close, pins the page behind and puts it back on Close", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Name").fill("peyton");
  await page.getByLabel("Password").fill(e2ePasswords.peyton);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "Hi Peyton" })).toBeVisible();

  const monday = addDays(mondayOf(new Date().toISOString().slice(0, 10)), 7 * 250);
  await openWeek(page, monday);
  const friday = page.getByRole("listitem", { name: "Friday" });
  await friday.getByRole("button", { name: "+ Pick a dinner" }).scrollIntoViewIfNeeded();
  const scrolled = await page.evaluate(() => window.scrollY);
  const before = (await friday.boundingBox())!;

  await friday.getByRole("button", { name: "+ Pick a dinner" }).tap();
  const sheet = page.getByRole("dialog", { name: "Dinner for Friday" });
  await expect(sheet).toBeFocused();
  expect(await sheet.getByRole("button", { name: "Close" }).evaluate((close) => close.matches(":focus-visible"))).toBe(false);

  // What iOS does when the keyboard comes up for the search field: it scrolls the page. Nothing behind may move.
  await sheet.getByLabel("Search recipes").tap();
  await page.evaluate(() => window.scrollBy(0, 600));
  expect(await friday.boundingBox()).toEqual(before);

  await sheet.getByRole("button", { name: "Close" }).tap();
  await expect(sheet).toBeHidden();
  expect(await page.evaluate(() => window.scrollY)).toBe(scrolled);
  expect(await friday.boundingBox()).toEqual(before);
});
