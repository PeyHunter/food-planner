import { expect, test, type Page } from "@playwright/test";
import { addDays, mondayOf } from "../src/shared/week.ts";
import { e2ePasswords } from "./passwords.ts";

const recipe = (title: string, types: string[]) => ({ title, feeds: 4, types, tags: [], ageFromMonths: null, ageToMonths: null, lines: [], steps: [] });

async function logIn(page: Page) {
  await page.goto("/");
  await page.getByLabel("Name").fill("peyton");
  await page.getByLabel("Password").fill(e2ePasswords.peyton);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "Hi Peyton" })).toBeVisible();
}

test("tapping what is already chosen in the dinner sheet takes it away again", async ({ page }) => {
  await logIn(page);
  const stamp = Date.now();
  const dinner = `Deselect dinner ${stamp}`;
  const salad = `Deselect salad ${stamp}`;
  await page.request.post("/api/recipes", { data: recipe(dinner, ["Fish"]) });
  await page.request.post("/api/recipes", { data: recipe(salad, ["Vegetables"]) });

  // A week far ahead, so no other test plans the same day.
  const monday = addDays(mondayOf(new Date().toISOString().slice(0, 10)), 7 * 20);
  await page.goto(`/#/week?monday=${monday}`);
  const tuesday = page.getByRole("listitem", { name: "Tuesday" });

  // Category chip: a second tap goes back to All.
  await tuesday.getByRole("button", { name: "+ Pick a dinner" }).click();
  const sheet = page.getByRole("dialog", { name: "Dinner for Tuesday" });
  const types = sheet.getByRole("group", { name: "Filter by type" });
  await types.getByRole("button", { name: "Fish" }).click();
  await expect(types.getByRole("button", { name: "Fish" })).toHaveAttribute("aria-pressed", "true");
  await types.getByRole("button", { name: "Fish" }).click();
  await expect(types.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");

  // Dish: pick it, then tap it again in the sheet to clear the day.
  await sheet.getByLabel("Search recipes").fill(dinner);
  await sheet.getByRole("button", { name: new RegExp(dinner) }).click();
  await expect(tuesday.getByText(dinner)).toBeVisible();
  await tuesday.getByRole("button", { name: "Change dinner on Tuesday" }).click();
  await sheet.getByLabel("Search recipes").fill(dinner);
  await expect(sheet.getByRole("button", { name: new RegExp(dinner) })).toHaveAttribute("aria-pressed", "true");
  await sheet.getByRole("button", { name: new RegExp(dinner) }).click();
  await expect(tuesday.getByRole("button", { name: "+ Pick a dinner" })).toBeVisible();

  // Side dish: added, then a second tap in the side sheet removes it.
  await tuesday.getByRole("button", { name: "+ Pick a dinner" }).click();
  await sheet.getByLabel("Search recipes").fill(dinner);
  await sheet.getByRole("button", { name: new RegExp(dinner) }).click();
  await tuesday.getByRole("button", { name: "+ Add a dish (like a salad)" }).click();
  const sides = page.getByRole("dialog", { name: "Another dish for Tuesday" });
  await sides.getByLabel("Search recipes").fill(salad);
  await sides.getByRole("button", { name: new RegExp(salad) }).click();
  await expect(tuesday.getByRole("list", { name: "More dishes on Tuesday" })).toContainText(salad);
  await tuesday.getByRole("button", { name: "+ Add a dish (like a salad)" }).click();
  await sides.getByLabel("Search recipes").fill(salad);
  await expect(sides.getByRole("button", { name: new RegExp(salad) })).toHaveAttribute("aria-pressed", "true");
  await sides.getByRole("button", { name: new RegExp(salad) }).click();
  await expect(tuesday.getByRole("list", { name: "More dishes on Tuesday" })).not.toContainText(salad);

  // Away type: Takeout, then Takeout again clears it.
  await tuesday.getByRole("button", { name: "Change dinner on Tuesday" }).click();
  await sheet.getByRole("button", { name: "Takeout" }).click();
  await expect(tuesday.getByText("Takeout")).toBeVisible();
  await tuesday.getByRole("button", { name: /Takeout/ }).click();
  await expect(sheet.getByRole("button", { name: "Takeout" })).toHaveAttribute("aria-pressed", "true");
  await sheet.getByRole("button", { name: "Takeout" }).click();
  await expect(tuesday.getByRole("button", { name: "+ Pick a dinner" })).toBeVisible();
});

test("the dinner sheet is a centred dialog on a computer and keeps its size while the list filters", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await logIn(page);
  const monday = addDays(mondayOf(new Date().toISOString().slice(0, 10)), 7 * 21);
  await page.goto(`/#/week?monday=${monday}`);
  await page.getByRole("listitem", { name: "Wednesday" }).getByRole("button", { name: "+ Pick a dinner" }).click();
  const sheet = page.getByRole("dialog", { name: "Dinner for Wednesday" });
  await expect(sheet).toBeVisible();
  const before = (await sheet.boundingBox())!;
  expect(Math.abs(before.x + before.width / 2 - 720)).toBeLessThan(2);
  expect(Math.abs(before.y + before.height / 2 - 450)).toBeLessThan(2);
  expect(before.width).toBeLessThanOrEqual(40 * 16 + 1);
  await sheet.getByLabel("Search recipes").fill("no dish is called this");
  await expect(sheet.getByText("No recipe matches.")).toBeVisible();
  expect(await sheet.boundingBox()).toEqual(before);
});

test("the logo and the greeting go to the front page", async ({ page }) => {
  await logIn(page);
  const tabs = page.getByRole("navigation", { name: "Main" });
  await tabs.getByRole("button", { name: "Shopping" }).click();
  await expect(tabs.getByRole("button", { name: "Shopping" })).toHaveAttribute("aria-current", "page");
  await page.getByRole("heading", { name: "Hi Peyton" }).click();
  await expect(tabs.getByRole("button", { name: "Week" })).toHaveAttribute("aria-current", "page");
  await expect(page).toHaveURL(/#\/week$/);

  await page.getByRole("link", { name: "Profile" }).click();
  await page.locator(".top .logo").click();
  await expect(tabs.getByRole("button", { name: "Week" })).toHaveAttribute("aria-current", "page");
});
