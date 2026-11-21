import { expect, test, type Page } from "@playwright/test";
import { addDays, mondayOf } from "../src/shared/week.ts";
import { e2ePasswords } from "./passwords.ts";

const shots = process.env.SHOTS_DIR;
const search = (words: string) => `https://www.nemlig.com/?search=${encodeURIComponent(words)}`;
const opened = (page: Page) => page.evaluate(() => (window as unknown as { opened: [string, string][] }).opened);

test("send the list to nemlig.com: first-time setup, check the list, fill the basket, tick off", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  // The app may only open nemlig.com pages; the test keeps what it opens instead.
  await page.addInitScript(() => {
    const kept: [string, string][] = [];
    (window as unknown as { opened: typeof kept }).opened = kept;
    window.open = (url?: string | URL, target?: string) => {
      kept.push([String(url), target ?? ""]);
      return null;
    };
  });
  await page.goto("/");
  await page.getByLabel("Name").fill("peyton");
  await page.getByLabel("Password").fill(e2ePasswords.peyton);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
  await page.request.put("/api/profile", { data: { nemlig: { on: false, day: 6, organic: "none" } } });

  // Next Friday: chicken in 500 g packs, courgettes, tinned tomatoes, and milk as an extra.
  const made = await page.request.post("/api/recipes", {
    data: {
      title: "Chicken traybake",
      feeds: 2,
      types: ["Chicken"],
      tags: [],
      ageFromMonths: null,
      ageToMonths: null,
      steps: [],
      lines: [
        { amount: 800, unit: "g", ingredient: "Chicken breasts", note: "" },
        { amount: 2, unit: "pcs", ingredient: "Courgettes", note: "" },
        { amount: 2, unit: "pcs", ingredient: "Hakkede tomat dåse", note: "" },
      ],
    },
  });
  const { id } = (await made.json()) as { id: string };
  const [chicken] = (await (await page.request.get("/api/ingredients?q=Chicken%20breasts")).json()) as { id: string; shopSection: string }[];
  await page.request.put(`/api/ingredients/${chicken!.id}`, { data: { shopSection: "Meat & fish", packAmount: 500, packUnit: "g", alwaysAtHome: false } });
  const nextMonday = addDays(mondayOf(new Date().toISOString().slice(0, 10)), 7);
  await page.request.put(`/api/plan/days/${addDays(nextMonday, 4)}`, { data: { dinnerRecipeId: id, people: 2 } });
  await page.request.post(`/api/shopping/${nextMonday}/extras`, { data: { name: "Milk" } });

  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Shopping" }).click();
  await page.getByRole("button", { name: "Next week" }).click();
  // Only Friday, so other tests' dinners stay out of this list.
  for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday", "Saturday", "Sunday"]) await page.getByRole("button", { name: day, exact: true }).click();
  await expect(page.getByRole("checkbox", { name: /Chicken breasts/ })).toBeVisible();
  // Pieces never stand alone (audit 20).
  await expect(page.getByRole("listitem").filter({ has: page.getByRole("checkbox", { name: /Courgettes/ }) })).toContainText("2 pcs");
  await page.getByRole("button", { name: "Send list to nemlig.com" }).click();

  // Setup, step 1: an account.
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: "Set up nemlig.com" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Back" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Close" })).toBeVisible();
  await expect(sheet.getByText("Step 1 of 3")).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/1-account.png` });
  await sheet.getByRole("button", { name: "Make one" }).click();
  expect(await opened(page)).toEqual([["https://www.nemlig.com/", "nemlig"]]);
  await sheet.getByRole("button", { name: "I have one now" }).click();

  // Step 2: delivery day and organic. Back goes to step 1 and forward again.
  await expect(sheet.getByText("Step 2 of 3")).toBeVisible();
  await sheet.getByRole("button", { name: "Back" }).click();
  await sheet.getByRole("button", { name: "Yes, I have one" }).click();
  await sheet.getByRole("radio", { name: "Friday" }).check();
  await sheet.getByRole("radio", { name: "Fruit & veg" }).check();
  if (shots) await page.screenshot({ path: `${shots}/2-settings.png` });
  await sheet.getByRole("button", { name: "Next" }).click();

  // Step 3: done, nemlig turns on for the kitchen and the send starts.
  await expect(sheet.getByText("Step 3 of 3")).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/3-ready.png` });
  await sheet.getByRole("button", { name: "Send my list" }).click();
  await expect(sheet.getByRole("heading", { name: "Check the list" })).toBeVisible();
  expect(((await (await page.request.get("/api/profile")).json()) as { nemlig: unknown }).nemlig).toEqual({ on: true, day: 4, organic: "produce" });

  // Check the list: Danish search words, organic for fruit and veg only, packs and amounts.
  const row = (name: string) => sheet.getByRole("listitem").filter({ hasText: name });
  await expect(row("Chicken breasts")).toContainText("2 packs");
  await expect(row("Chicken breasts")).toContainText("kyllingebryst");
  await expect(row("Courgettes")).toContainText("økologisk squash");
  await expect(row("Hakkede tomat dåse")).toContainText("2 pcs");
  await expect(row("Milk")).toContainText("mælk");
  await expect(row("Milk")).not.toContainText("økologisk");
  if (shots) await page.screenshot({ path: `${shots}/4-check.png` });

  // Change a word: remembered for next week.
  await sheet.getByRole("button", { name: "Change the search for Chicken breasts" }).click();
  await sheet.getByLabel("Search word").fill("kyllingefilet");
  if (shots) await page.screenshot({ path: `${shots}/5-edit-word.png` });
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(row("Chicken breasts")).toContainText("kyllingefilet");
  expect(await (await page.request.get("/api/nemlig/remembered")).json()).toEqual({ [chicken!.id]: { word: "kyllingefilet", link: null } });

  // Leave milk out of this send.
  await sheet.getByRole("button", { name: "Leave Milk out" }).click();
  await expect(sheet.getByText("Left out: Milk.")).toBeVisible();
  await sheet.getByRole("button", { name: "Copy the list" }).click();
  await expect(sheet.getByRole("button", { name: "Copied ✓" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("2 stk økologisk squash\n2 pakker kyllingefilet\n2 stk Hakkede tomat dåse");

  // Fill the basket, one at a time, in one reused nemlig tab.
  await sheet.getByRole("button", { name: "Fill the basket (3)" }).click();
  await expect(sheet.getByText("1 of 3")).toBeVisible();
  await expect(sheet.getByRole("heading", { name: "økologisk squash" })).toBeVisible();
  await sheet.getByRole("button", { name: "Find on nemlig.com" }).click();
  expect((await opened(page)).at(-1)).toEqual([search("økologisk squash"), "nemlig"]);
  if (shots) await page.screenshot({ path: `${shots}/6-fill.png` });
  await sheet.getByRole("button", { name: "In the basket" }).click();

  await expect(sheet.getByText("2 of 3")).toBeVisible();
  // Back to the item before, and forward again.
  await sheet.getByRole("button", { name: "Back" }).click();
  await expect(sheet.getByText("1 of 3")).toBeVisible();
  await sheet.getByRole("button", { name: "In the basket" }).click();
  await sheet.getByRole("button", { name: "Find on nemlig.com" }).click();
  expect((await opened(page)).at(-1)).toEqual([search("kyllingefilet"), "nemlig"]);

  // A reload carries on at the same item, on the same week.
  await page.reload();
  await expect(page.getByRole("dialog").getByText("2 of 3")).toBeVisible();
  await sheet.getByRole("button", { name: "In the basket" }).click();
  await expect(sheet.getByText("3 of 3")).toBeVisible();
  await sheet.getByRole("button", { name: "Find on nemlig.com" }).click();
  expect((await opened(page)).at(-1)).toEqual([search("Hakkede tomat dåse"), "nemlig"]);
  await sheet.getByRole("button", { name: "Skip" }).click();

  // Done: open nemlig.com to pay, and tick off what went in.
  await expect(sheet.getByRole("heading", { name: "2 of 3 in your basket." })).toBeVisible();
  await expect(sheet.getByText("Skipped: Hakkede tomat dåse")).toBeVisible();
  await expect(sheet.getByRole("switch", { name: /Tick them off the shopping list \(2\)/ })).toBeChecked();
  if (shots) await page.screenshot({ path: `${shots}/7-done.png` });
  await sheet.getByRole("button", { name: "Open nemlig.com" }).click();
  expect((await opened(page)).at(-1)).toEqual(["https://www.nemlig.com/", "nemlig"]);
  await sheet.getByRole("button", { name: "Finish" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: /Chicken breasts/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("checkbox", { name: /Courgettes/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("checkbox", { name: /Hakkede tomat dåse/ })).toHaveAttribute("aria-checked", "false");
  await expect(page.getByRole("checkbox", { name: /Milk/ })).toHaveAttribute("aria-checked", "false");

  // Only nemlig.com pages were ever opened.
  for (const [url] of await opened(page)) expect(url).toMatch(/^https:\/\/www\.nemlig\.com\//);
  await page.request.put("/api/profile", { data: { nemlig: { on: false, day: 6, organic: "none" } } });
});
