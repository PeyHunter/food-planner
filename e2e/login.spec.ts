import { expect, test } from "@playwright/test";
import { e2ePasswords } from "./passwords.ts";

test("peyton logs in on an iPhone, stays logged in, and logs out", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Food planner" })).toBeVisible();

  await page.getByLabel("Name").fill("peyton");
  await page.getByLabel("Password").fill("not-it");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("alert")).toHaveText("Wrong name or password.");

  await page.getByLabel("Password").fill(e2ePasswords.peyton);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "Hi Peyton" })).toBeVisible();
  await expect(page.getByText("Nothing here yet.")).toBeVisible();
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });

  await page.reload();
  await expect(page.getByRole("heading", { name: "Hi Peyton" })).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
});

test("ronja logs in to the same kitchen", async ({ page, request }) => {
  await page.goto("/");
  await page.getByLabel("Name").fill("ronja");
  await page.getByLabel("Password").fill(e2ePasswords.ronja);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "Hi Ronja" })).toBeVisible();
  const me = await page.request.get("/api/me");
  expect(((await me.json()) as { kitchen: { name: string } }).kitchen.name).toBe("Our kitchen");
  expect((await request.get("/api/me")).status()).toBe(401);
});

test("the app can be added to the home screen", async ({ request }) => {
  const manifest = (await (await request.get("/manifest.webmanifest")).json()) as { icons: { src: string }[] };
  for (const icon of manifest.icons) expect((await request.get(icon.src)).headers()["content-type"]).toBe("image/png");
});
