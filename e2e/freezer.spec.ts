import { expect, test } from "@playwright/test";
import { addDays, mondayOf, weekDates } from "../src/shared/week.ts";
import { e2ePasswords } from "./passwords.ts";

// Six weeks ahead, so no other spec plans the same days.
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
  const offer = page.getByRole("form", { name: "Put portions in the freezer?" });
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
