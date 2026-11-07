import { expect, test } from "@playwright/test";
import { e2eLogins } from "./logins.ts";

test("Peyton logs in, stays logged in after a reload, and logs out", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Username").fill("peyton");
  await page.getByLabel("Password").fill("wrong");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("alert")).toHaveText("That username or password is wrong.");

  await page.getByLabel("Password").fill(e2eLogins().peyton);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "Hi Peyton" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Hi Peyton" })).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
});

test("the app can be added to the home screen", async ({ page, request }) => {
  await page.goto("/");
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
  const manifest = (await (await request.get(manifestHref!)).json()) as { name: string; display: string; icons: { src: string }[] };
  expect(manifest).toMatchObject({ name: "Food Planner", display: "standalone" });
  for (const icon of manifest.icons) expect((await request.get(icon.src)).headers()["content-type"]).toBe("image/png");
  const touchIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  expect((await request.get(touchIcon!)).status()).toBe(200);
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute("content", "yes");
});
