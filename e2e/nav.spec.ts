import { expect, test } from "@playwright/test";
import { e2ePasswords } from "./passwords.ts";

test("the bottom nav has one recipes tab, starts on the grid, and each tab opens", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Name").fill("peyton");
  await page.getByLabel("Password").fill(e2ePasswords.peyton);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "Hi Peyton" })).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("button")).toHaveText([/Recipes$/, /Week$/, /Shopping$/, /(Runi Lee|Kids)$/]);
  await expect(nav.getByRole("button", { name: "Home" })).toHaveCount(0);
  await expect(nav.getByRole("button", { name: "Recipes" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { level: 2, name: "What shall we cook?" })).toBeVisible();
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });

  // The kids tab is named after the kitchen's children: "Runi Lee" alone, "Kids" once there are more.
  for (const label of ["Week", "Shopping", /^(Runi Lee|Kids)$/, "Recipes"]) {
    const tab = nav.getByRole("button", { name: label });
    await tab.click();
    await expect(tab).toHaveAttribute("aria-current", "page");
    const heading = label === "Recipes" ? "What shall we cook?" : label;
    await expect(page.getByRole("heading", { level: 2, name: heading }).first()).toBeVisible();
    await expect(page.getByText("Coming soon")).toBeHidden();
  }

  const box = await nav.boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
});
