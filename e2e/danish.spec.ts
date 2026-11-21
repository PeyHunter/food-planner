import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { addDays, mondayOf } from "../src/shared/week.ts";
import { e2ePasswords } from "./passwords.ts";

const shots = process.env.SHOTS_DIR ?? "test-results";
const recipe = (title: string, types: string[], lines: unknown[] = []) => ({ title, feeds: 2, types, tags: [], ageFromMonths: null, ageToMonths: null, lines, steps: ["Cook it."] });

test("in Danish: a dinner out, a salad next to the main dish, send to nemlig.com, bought it all, share as picture", async ({ page }) => {
  const stamp = Date.now();
  await page.goto("/");
  await page.getByLabel("Name").fill("peyton");
  await page.getByLabel("Password").fill(e2ePasswords.peyton);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();

  const main = (await (await page.request.post("/api/recipes", { data: recipe(`Laks ${stamp}`, ["Fish"]) })).json()) as { id: string };
  const salad = (await (
    await page.request.post("/api/recipes", { data: recipe(`Salat ${stamp}`, ["Vegetables"], [{ amount: 1, unit: "bag", ingredient: `Spinat ${stamp}`, note: "" }]) })
  ).json()) as { id: string };
  const jpeg = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#5d9cf0" } }).jpeg().toBuffer();
  await page.request.post(`/api/recipes/${main.id}/photos`, { multipart: { role: "main", photo: { name: "laks.jpg", mimeType: "image/jpeg", buffer: jpeg } } });

  // Profile: Danish and nemlig.com.
  await page.getByRole("link", { name: "Profile" }).click();
  await page.getByRole("radio", { name: "Dansk" }).click();
  await expect(page.getByRole("heading", { name: "Profil" })).toBeVisible();
  await page.getByRole("switch", { name: "Vi handler hos nemlig.com" }).check();
  await page.getByRole("radio", { name: "Alt", exact: true }).check();
  await page.screenshot({ path: `${shots}/profile-da.png`, fullPage: true });

  // Next week, so no day is in the past: Monday salmon + salad, Tuesday out.
  const nextMonday = addDays(mondayOf(new Date().toISOString().slice(0, 10)), 7);
  await page.request.put(`/api/plan/days/${nextMonday}`, { data: { dinnerRecipeId: main.id } });
  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Uge" }).click();
  await page.getByRole("button", { name: "Next week" }).click();
  const monday = page.getByRole("listitem", { name: /mandag/i });
  await monday.getByRole("button", { name: "+ Tilføj en ret (fx en salat)" }).click();
  await page.getByRole("dialog").getByRole("button", { name: new RegExp(`Salat ${stamp}`) }).click();
  await expect(monday.getByText(`Salat ${stamp}`)).toBeVisible();

  const tuesday = page.getByRole("listitem", { name: /tirsdag/i });
  // Earlier tests may have planned this day already: then Change opens the picker, else the empty dinner button does.
  await tuesday.locator("button.dish, button.change").first().click();
  await page.getByRole("dialog").getByLabel("Note, like where you eat").fill("Hos Isabel");
  await page.getByRole("dialog").getByRole("button", { name: /På besøg/ }).click();
  await expect(tuesday.getByText("Hos Isabel")).toBeVisible();
  await monday.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${shots}/week-da.png` });

  // Shopping next week: the salad's spinach comes in bags; the nemlig.com send searches for it, organic.
  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Indkøb" }).click();
  await page.getByRole("button", { name: "Næste uge" }).click();
  await expect(page.getByText(`Spinat ${stamp}`).first()).toBeVisible();
  await expect(page.getByText(/1 pose/).first()).toBeVisible();
  await page.getByRole("button", { name: "Send listen til nemlig.com" }).click();
  const sheet = page.getByRole("dialog", { name: "Tjek listen" });
  await expect(sheet.getByRole("listitem").filter({ hasText: `Spinat ${stamp}` })).toContainText(`økologisk Spinat ${stamp}`);
  await expect(sheet.getByRole("listitem").filter({ hasText: `Spinat ${stamp}` })).toContainText("1 pose");
  await page.screenshot({ path: `${shots}/nemlig-da.png`, fullPage: true });
  await sheet.getByRole("button", { name: "Luk" }).click();
  await page.getByRole("button", { name: "✓ Alt er købt" }).click();
  await expect(page.getByText(`Spinat ${stamp}`)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Hent tilbage" })).toBeVisible();

  // Share the recipe as a picture: without a share sheet for files, it is saved.
  await page.goto(`/#/recipes/${main.id}`);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Del som billede" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(`Laks-${stamp}.jpg`);
  const picture = await sharp(await file.path()).metadata();
  expect([picture.format, picture.width]).toEqual(["jpeg", 1080]);
  await file.saveAs(`${shots}/recipe-picture.jpg`);

  // Back to English for anyone after this.
  await page.request.put("/api/profile", { data: { language: "en", nemlig: { on: false, organic: "none" } } });
});

test("Profile is in the header on every tab, English | Dansk switches at once, Back returns to the tab", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Name").fill("peyton");
  await page.getByLabel("Password").fill(e2ePasswords.peyton);
  await page.getByRole("button", { name: "Log in" }).click();
  const nav = page.getByRole("navigation", { name: "Main" });
  await nav.getByRole("button", { name: "Shopping" }).click();

  const header = page.locator("header.top");
  await header.getByRole("link", { name: "Profile" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Profile" })).toBeVisible();
  const language = page.getByRole("radiogroup", { name: "Language" });
  await expect(page.locator(".profile .card").first()).toContainText("Language");
  await expect(language.getByRole("radio", { name: "English" })).toBeChecked();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();

  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await language.getByRole("radio", { name: "Dansk" }).click();
  await expect(nav.getByRole("button")).toHaveText([/Opskrifter$/, /Uge$/, /Indkøb$/, /(Runi Lee|Børn)$/]);
  // The page says it is Danish, so the browser spellchecks Danish.
  await expect(page.locator("html")).toHaveAttribute("lang", "da");
  await expect(header.getByRole("link", { name: "Profil" })).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Sprog" }).getByRole("radio", { name: "Dansk" })).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByRole("radiogroup", { name: "Sprog" }).getByRole("radio", { name: "English" }).click();
  await expect(nav.getByRole("button", { name: "Week" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  // Profile was reloaded, so Back has no tab to return to and goes to Week.
  await page.getByRole("button", { name: "Back" }).click();
  await expect(nav.getByRole("button", { name: "Week" })).toHaveAttribute("aria-current", "page");

  await nav.getByRole("button", { name: "Shopping" }).click();
  await header.getByRole("link", { name: "Profile" }).click();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(nav.getByRole("button", { name: "Shopping" })).toHaveAttribute("aria-current", "page");
});

test("in Danish, typos in a recipe get Danish 'Mente du' fixes, never English ones", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Name").fill("peyton");
  await page.getByLabel("Password").fill(e2ePasswords.peyton);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
  await page.getByRole("link", { name: "Profile" }).click();
  await page.getByRole("radio", { name: "Dansk" }).click();
  await expect(page.getByRole("heading", { name: "Profil" })).toBeVisible();

  try {
    await page.goto("/#/recipes/new");
    const typed = page.getByLabel("Ingredient 1");
    const fixes = page.locator(".line-hint .chip");
    for (const [typo, fix] of [
      ["mæk", "mælk?"],
      ["laksefilt", "laksefilet?"],
      ["dil", "dild?"],
      ["seleri", "selleri?"],
    ]) {
      await typed.fill(typo!);
      await expect(page.getByText("Mente du:")).toBeVisible();
      await expect(fixes.first()).toHaveText(fix!);
      await expect(fixes.filter({ hasText: /^(milk|salmon|dill|celery|celeriac)/ })).toHaveCount(0);
    }
    await page.screenshot({ path: `${shots}/did-you-mean-da.png` });
    await fixes.first().click();
    await expect(typed).toHaveValue("selleri");
  } finally {
    await page.request.put("/api/profile", { data: { language: "en" } });
  }
});
