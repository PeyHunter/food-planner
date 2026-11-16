import { expect, test } from "@playwright/test";
import { e2ePasswords } from "./passwords.ts";

/** The 1st of the month seven months back, so she is 7 months old all this month. */
function sevenMonthsAgo() {
  const day = new Date();
  day.setDate(1);
  day.setMonth(day.getMonth() - 7);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-01`;
}

test("set Runi's birthday, add a 6-12 month recipe and see it fit her age", async ({ page }) => {
  const title = `Pear and oat mash ${Date.now()}`;

  await page.goto("/");
  await page.getByLabel("Name").fill("peyton");
  await page.getByLabel("Password").fill(e2ePasswords.peyton);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Runi & kids" }).click();

  await expect(page.getByRole("group", { name: "Pick a child" }).getByRole("button").first()).toHaveText(/Runi Lee/);
  const about = page.getByRole("region", { name: "About Runi Lee" });
  await about.getByRole("button", { name: /Set birthday|Edit/ }).click();
  await about.getByLabel("Birthday").fill(sevenMonthsAgo());
  await about.getByRole("button", { name: "Save" }).click();
  await expect(about.getByText("7 months old")).toBeVisible();

  // Her rules, big and in plain words, with this week's progress.
  const rules = page.getByRole("region", { name: "Runi Lee's rules" });
  await expect(rules.getByText("Fish at least 2 a week")).toBeVisible();
  await rules.getByRole("button", { name: "Change rules" }).click();
  await rules.getByLabel("How many: Vegetables at least 5 a week").selectOption("4");
  await rules.getByRole("button", { name: "Done" }).click();
  await expect(rules.getByText("Vegetables at least 4 a week")).toBeVisible();
  await rules.getByRole("button", { name: "Change rules" }).click();
  await rules.getByLabel("How many: Vegetables at least 4 a week").selectOption("5");
  await rules.getByRole("button", { name: "Done" }).click();
  await expect(rules.getByText("Vegetables at least 5 a week")).toBeVisible();

  await page.getByRole("link", { name: "+ New recipe for Runi Lee" }).click();
  await expect(page.getByRole("heading", { name: "New recipe" })).toBeVisible();
  await expect(page.getByRole("button", { name: "for Runi" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Suits babies from (months)")).toHaveValue("7");
  await page.getByLabel("Name").fill(title);
  await page.getByRole("button", { name: "Vegetables" }).click();
  await page.getByLabel("Suits babies from (months)").fill("6");
  await page.getByLabel("to (months)").fill("12");
  await page.getByRole("button", { name: "Save recipe" }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.getByText("For 6–12 months")).toBeVisible();

  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Runi & kids" }).click();
  // Tagged "for Runi" and fits her age: in her own list, which comes first.
  const fits = page.getByRole("list", { name: "Runi Lee's recipes" });
  await expect(fits.getByRole("link", { name: new RegExp(title) })).toContainText("For 6–12 months");
  await expect(page.locator(".kid-recipes h2").first()).toHaveText("Runi Lee's recipes");
  await expect(page.getByRole("list", { name: "Also fits Runi Lee's age" }).getByRole("link", { name: new RegExp(title) })).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: process.env.KIDS_SHOT ?? "test-results/kids.png", fullPage: true });

  await fits.getByRole("link", { name: new RegExp(title) }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

  // Her recipes stay on her tab: the grown-ups' recipe list doesn't show them.
  await page.goto("/#/recipes/list");
  await page.getByLabel("Search recipes").fill(title);
  await expect(page.getByText('No recipe matches')).toBeVisible();
});

test("add a child with a birthday", async ({ page }) => {
  const name = `Bo ${Date.now()}`;
  await page.goto("/");
  await page.getByLabel("Name").fill("peyton");
  await page.getByLabel("Password").fill(e2ePasswords.peyton);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Runi & kids" }).click();

  await page.getByRole("button", { name: "+ Add a child" }).click();
  const form = page.getByRole("form", { name: "Add a child" });
  await form.getByLabel("Name").fill(name);
  await form.getByLabel("Birthday").fill(sevenMonthsAgo());
  await form.getByRole("button", { name: "Add child" }).click();
  await expect(page.getByRole("button", { name: new RegExp(name) })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: `About ${name}` }).getByText("7 months old")).toBeVisible();

  // Clean up so other tests see only Runi Lee.
  const children = (await (await page.request.get("/api/children")).json()) as { id: string; name: string }[];
  await page.request.delete(`/api/children/${children.find((child) => child.name === name)!.id}`);
});
