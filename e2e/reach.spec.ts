import { devices, expect, test, type Page } from "@playwright/test";
import { e2ePasswords } from "./passwords.ts";

// The smallest iPhone still in use. Every button in a sheet must be on screen and take the tap.
test.use({ viewport: devices["iPhone SE"].viewport });

const recipe = (title: string) => ({ title, feeds: 4, types: ["Fish"], tags: [], ageFromMonths: null, ageToMonths: null, lines: [], steps: [] });

/** Scrolls each control into view and checks a tap in its middle lands on it, not on something on top. */
async function unreachable(page: Page) {
  return page.evaluate(() => {
    const sheet = document.querySelector("dialog[open]");
    if (!sheet) return ["no open sheet"];
    const misses: string[] = [];
    for (const control of sheet.querySelectorAll<HTMLElement>("button, input, a")) {
      control.scrollIntoView({ block: "center" });
      const box = control.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      const onScreen = box.left >= 0 && box.right <= window.innerWidth && box.top >= 0 && box.bottom <= window.innerHeight;
      if (!onScreen || !hit || !control.contains(hit)) misses.push(control.textContent?.trim() || control.getAttribute("aria-label") || control.tagName);
    }
    return misses;
  });
}

test("the dinner sheet keeps every button reachable on a small phone", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Name").fill("peyton");
  await page.getByLabel("Password").fill(e2ePasswords.peyton);
  await page.getByRole("button", { name: "Log in" }).click();

  // The name menu has a big round button that opens Profile.
  const caret = page.locator(".me .caret");
  const size = await caret.boundingBox();
  expect(size!.width).toBeGreaterThanOrEqual(44);
  expect(size!.height).toBeGreaterThanOrEqual(44);
  await caret.click();
  await expect(page.getByRole("link", { name: "Profile" })).toBeVisible();
  await page.keyboard.press("Escape");

  const stamp = Date.now();
  for (let n = 0; n < 8; n++) await page.request.post("/api/recipes", { data: recipe(`Reach test dish ${n} with a long name ${stamp}`) });

  await page.getByRole("button", { name: "Next week" }).click();
  const friday = page.getByRole("listitem", { name: "Friday" });
  await friday.getByRole("button", { name: "+ Pick a dinner" }).click();
  const sheet = page.getByRole("dialog", { name: "Dinner for Friday" });
  await sheet.getByLabel("Search recipes").fill(`Reach test dish`);
  await expect(sheet.getByRole("button", { name: /Reach test dish 7/ })).toBeVisible();

  // Every type is on screen without sliding the row sideways.
  for (const type of ["All", "Fish", "Meat", "Chicken", "Vegetarian", "Vegetables"]) await expect(sheet.getByRole("button", { name: type, exact: true })).toBeInViewport();
  expect(await unreachable(page)).toEqual([]);

  // At the bottom of the list, the page behind has not moved and Close is still there.
  const before = await page.evaluate(() => window.scrollY);
  await sheet.getByRole("button", { name: /Reach test dish 7/ }).scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 2000);
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
  await expect(sheet.getByRole("button", { name: "Close" })).toBeInViewport();
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toBeHidden();
});
