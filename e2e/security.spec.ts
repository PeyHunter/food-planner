import { expect, test, type Page } from "@playwright/test";
import { e2ePasswords } from "./passwords.ts";

async function logIn(page: Page, name: "peyton" | "ronja") {
  await page.goto("/");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Password").fill(e2ePasswords[name]!);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("heading", { name: `Hi ${name.charAt(0).toUpperCase()}${name.slice(1)}` })).toBeVisible();
}

/** Chromium's built-in stand-in for Face ID: it says yes to every passkey request. */
async function virtualAuthenticator(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
}

test("ronja adds a passkey, logs in with it, and must confirm it's you before removing it", async ({ page }) => {
  await virtualAuthenticator(page);
  await logIn(page, "ronja");
  await page.getByRole("link", { name: "Profile" }).click();
  const passkeys = page.getByRole("region", { name: "Passkeys" });
  await passkeys.getByRole("button", { name: "Use Face ID / fingerprint to log in" }).click();
  await expect(passkeys.getByRole("button", { name: /^Remove passkey/ })).toHaveCount(1);
  await expect(page.getByRole("region", { name: "Activity" })).toContainText("Passkey added");

  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await page.getByRole("button", { name: "Use Face ID / fingerprint" }).click();
  await expect(page.getByRole("heading", { name: "Hi Ronja" })).toBeVisible();

  // Logged in with the password now, so removing the passkey asks for the passkey first.
  await page.getByRole("link", { name: "Profile" }).click();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await logIn(page, "ronja");
  await page.getByRole("link", { name: "Profile" }).click();
  await passkeys.getByRole("button", { name: /^Remove passkey/ }).click();
  const sheet = page.getByRole("dialog", { name: "Confirm it's you" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Use Face ID / fingerprint" }).click();
  await expect(sheet).toBeHidden();
  await expect(passkeys.getByRole("button", { name: /^Remove passkey/ })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Activity" }).getByRole("listitem").first()).toContainText("Passkey removed");
});

test("after 10 wrong tries the login screen says to wait", async ({ page }) => {
  // A made-up address, so the other tests' logins from this machine are not held up.
  await page.setExtraHTTPHeaders({ "x-forwarded-for": "203.0.113.50" });
  await page.goto("/");
  await page.getByLabel("Name").fill("nobody");
  for (let i = 0; i < 10; i++) {
    await page.getByLabel("Password").fill(`wrong-${i}`);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText("Wrong name or password.");
    await page.getByLabel("Password").fill("");
  }
  await page.getByLabel("Password").fill("wrong-again");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Too many wrong tries. Wait 15 minutes and try again.");
});

test("Devices: log out everywhere else ends the other phone's login", async ({ page, browser }) => {
  const other = await browser.newPage();
  await logIn(other, "peyton");
  await logIn(page, "peyton");
  await page.getByRole("link", { name: "Profile" }).click();
  const devices = page.getByRole("region", { name: "Devices" });
  await expect(devices.getByText("This device")).toBeVisible();
  await expect(devices.getByRole("button", { name: /^Log out .+/ }).first()).toBeVisible();

  await devices.getByRole("button", { name: "Log out everywhere else" }).click();
  await expect(devices.getByRole("listitem")).toHaveCount(1);
  await expect(devices.getByRole("button", { name: "Log out everywhere else" })).toBeHidden();
  await other.reload();
  await expect(other.getByRole("button", { name: "Log in", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
  await other.close();
});
