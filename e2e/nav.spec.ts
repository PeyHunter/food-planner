import { expect, test } from "@playwright/test";
import { e2ePasswords } from "./passwords.ts";

test("the bottom nav has four tabs and each one opens", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Name").fill("peyton");
  await page.getByLabel("Password").fill(e2ePasswords.peyton);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "Hi Peyton" })).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("button")).toHaveText([/Recipes$/, /Week$/, /Shopping$/, /Runi & kids$/]);
  await expect(nav.getByRole("button", { name: "Week" })).toHaveAttribute("aria-current", "page");
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });

  for (const label of ["Recipes", "Shopping", "Runi & kids", "Week"]) {
    const tab = nav.getByRole("button", { name: label });
    await tab.click();
    await expect(tab).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { level: 2, name: label === "Recipes" ? "Flip through the book" : label })).toBeVisible();
    await expect(page.getByText("Coming soon")).toBeVisible({ visible: label === "Shopping" });
  }

  const box = await nav.boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
});
