import { expect, test } from "@playwright/test";
import { addDays, mondayOf, weekDates, type FreezerItem, type WeekView } from "../src/shared/week.ts";
import { e2ePasswords } from "./passwords.ts";

// Six weeks ahead, so no other spec plans the same days. Create week uses the freezer, so this file runs on its own, after the rest.
const weeksAhead = 6;

test("log 6 portions after cooking, plan a night from the freezer: 5 remain and the list is unchanged", async ({ page }) => {
  const stamp = Date.now();
  const stew = `Fish stew ${stamp}`;

  await page.goto("/");
  await page.getByLabel("Name").fill("peyton");
  await page.getByLabel("Password").fill(e2ePasswords.peyton);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();

  const made = await page.request.post("/api/recipes", {
    data: {
      title: stew,
      feeds: 4,
      types: ["Fish"],
      tags: ["freezable"],
      ageFromMonths: null,
      ageToMonths: null,
      lines: [{ amount: 600, unit: "g", ingredient: `Haddock ${stamp}`, note: "" }],
      steps: [],
    },
  });
  const { id } = (await made.json()) as { id: string };

  // "I made this" on a freezable dish offers the freezer.
  await page.goto(`/#/recipes/${id}`);
  await page.getByRole("button", { name: "I made this" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  const offer = page.getByRole("form", { name: "How many portions go in the freezer?" });
  await offer.getByLabel("Portions").fill("6");
  await offer.getByRole("button", { name: "Put in the freezer" }).click();
  await expect(page.getByText("6 in the freezer")).toBeVisible();
  await page.getByRole("link", { name: "See the freezer" }).click();
  await expect(page.getByRole("group", { name: `Portions of ${stew}` })).toContainText("6 portions");

  const today = await page.evaluate(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const monday = addDays(mondayOf(today), 7 * weeksAhead);
  const listPath = `/api/shopping/${monday}?days=${weekDates(monday).join(",")}`;
  const before = await (await page.request.get(listPath)).json();

  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Week" }).click();
  await expect(page.getByRole("link", { name: /Freezer/ })).toBeVisible();
  for (let week = 0; week < weeksAhead; week++) await page.getByRole("button", { name: "Next week" }).click();
  const tuesday = page.getByRole("listitem", { name: "Tuesday" });
  await tuesday.getByRole("button", { name: "+ Pick a dinner" }).click();
  const sheet = page.getByRole("dialog", { name: "Dinner for Tuesday" });
  await sheet.getByRole("button", { name: `From the freezer: ${stew}` }).click();
  await expect(sheet).toBeHidden();
  await expect(tuesday.getByText(stew)).toBeVisible();
  await expect(tuesday.getByText("From the freezer")).toBeVisible();
  await page.screenshot({ path: ".peystack/shots/f4.png", fullPage: true });

  const after = await (await page.request.get(listPath)).json();
  expect(after.sections).toEqual(before.sections);

  await page.getByRole("link", { name: /Freezer/ }).click();
  await expect(page.getByRole("group", { name: `Portions of ${stew}` })).toContainText("5 portions");
});

// Eight weeks ahead, clear of the test above.
const splitWeeksAhead = 8;

test("any cook can go in the freezer, the freezer takes portions directly, and Create week plans a freezer night", async ({ page }) => {
  const stamp = Date.now();
  const curry = `Lentil curry ${stamp}`;
  const soup = `Pea soup ${stamp}`;

  await page.goto("/");
  await page.getByLabel("Name").fill("peyton");
  await page.getByLabel("Password").fill(e2ePasswords.peyton);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();

  const recipe = (title: string) => ({
    title,
    feeds: 4,
    types: ["Vegetarian"],
    tags: [],
    ageFromMonths: null,
    ageToMonths: null,
    lines: [{ amount: 300, unit: "g", ingredient: `Lentils ${stamp}`, note: "" }],
    steps: [],
  });
  const { id } = (await (await page.request.post("/api/recipes", { data: recipe(curry) })).json()) as { id: string };
  await page.request.post("/api/recipes", { data: recipe(soup) });

  // A dish not tagged freezable still asks; 0 is the suggestion.
  await page.goto(`/#/recipes/${id}`);
  await page.getByRole("button", { name: "I made this" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  const offer = page.getByRole("form", { name: "How many portions go in the freezer?" });
  await expect(offer.getByLabel("Portions")).toHaveValue("0");
  await page.screenshot({ path: ".peystack/shots/freezer-question.png" });
  await offer.getByLabel("Portions").fill("3");
  await offer.getByRole("button", { name: "Put in the freezer" }).click();
  await expect(page.getByText("3 in the freezer")).toBeVisible();
  await page.getByRole("link", { name: "See the freezer" }).click();
  await expect(page.getByRole("group", { name: `Portions of ${curry}` })).toContainText("3 portions");

  // Add portions of any dish straight on the Freezer screen.
  const add = page.getByRole("form", { name: "Add to the freezer" });
  await add.getByLabel("Dish").selectOption({ label: soup });
  await add.getByLabel("Portions").fill("2");
  await add.getByRole("button", { name: "Add" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".peystack/shots/freezer-add.png" });
  await add.getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("group", { name: `Portions of ${soup}` })).toContainText("2 portions");

  // Create week fills nights from the freezer: each one takes a portion of that dish.
  const counts = async () => {
    const items = (await (await page.request.get("/api/freezer")).json()) as FreezerItem[];
    return Object.fromEntries(items.map((item) => [item.recipe.id, item.count]));
  };
  const before = await counts();
  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Week" }).click();
  for (let week = 0; week < splitWeeksAhead; week++) await page.getByRole("button", { name: "Next week" }).click();
  await page.getByRole("button", { name: "Create week" }).click();
  const note = page.getByRole("region", { name: "Create week" }).getByRole("status");
  await expect(note).toContainText(/\(\d+ from the freezer\)/);
  const nights = Number(/\((\d+) from the freezer\)/.exec((await note.textContent()) ?? "")![1]);
  await expect(page.getByText("❄ From the freezer")).toHaveCount(nights);
  const today = await page.evaluate(() => new Date().toLocaleDateString("en-CA"));
  const week = (await (await page.request.get(`/api/plan/weeks/${addDays(mondayOf(today), 7 * splitWeeksAhead)}`)).json()) as WeekView;
  const frozen = week.days.filter((day) => day.fromFreezer).map((day) => day.dinner!.id);
  expect(frozen).toHaveLength(nights);
  const after = await counts();
  for (const dish of frozen) expect(after[dish] ?? 0).toBe(before[dish]! - 1);

  // Undo puts the portions back.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("❄ From the freezer")).toHaveCount(0);
  const undone = await counts();
  for (const dish of frozen) expect(undone[dish]).toBe(before[dish]);
});
