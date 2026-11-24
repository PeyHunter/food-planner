import { expect, test } from "@playwright/test";
import { addDays, mondayOf } from "../src/shared/week.ts";
import { e2ePasswords } from "./passwords.ts";

const today = () => new Date().toISOString().slice(0, 10);

test("Runi's own freezer holds her food, and a week meal can come from it", async ({ page }) => {
  const stamp = Date.now();
  const title = `Runi freezer test ${stamp}`;

  await page.goto("/");
  await page.getByLabel("Name").fill("peyton");
  await page.getByLabel("Password").fill(e2ePasswords.peyton);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "Hi Peyton" })).toBeVisible();

  const made = await page.request.post("/api/recipes", {
    data: { title, feeds: 2, types: ["Vegetarian"], tags: ["freezable", "for Runi"], ageFromMonths: null, ageToMonths: null, lines: [], steps: [] },
  });
  expect(made.ok()).toBe(true);

  const nav = page.getByRole("navigation", { name: "Main" });
  await nav.getByRole("button", { name: /^(Runi Lee|Kids)$/ }).click();
  const freezer = page.getByRole("region", { name: "Runi Lee's freezer" });
  await expect(freezer).toBeVisible();
  const choice = freezer.getByRole("listitem").filter({ hasText: title });
  await choice.getByRole("button", { name: "Put one portion in" }).click();
  await expect(freezer.getByRole("listitem").filter({ hasText: title })).toContainText("1 portion");

  const monday = addDays(mondayOf(today()), 7 * 300);
  await page.goto(`/#/week?monday=${monday}`);
  await expect(page.getByRole("heading", { name: /^Week/ })).toBeVisible();
  const wednesday = page.getByRole("listitem", { name: "Wednesday" });
  await wednesday.getByRole("button", { name: /Runi Lee/ }).click();
  const sheet = page.getByRole("dialog", { name: "Runi Lee on Wednesday" });
  await expect(sheet.getByRole("heading", { name: "❄ From Runi Lee's freezer" })).toBeVisible();
  await sheet.getByRole("button", { name: `From Runi Lee's freezer: ${title}` }).click();
  await expect(wednesday.getByText(title)).toBeVisible();
  await expect(wednesday.getByText("❄ From the freezer")).toBeVisible();
});
