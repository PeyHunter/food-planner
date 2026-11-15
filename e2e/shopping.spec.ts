import { expect, test, type Browser, type Page } from "@playwright/test";
import { e2ePasswords } from "./passwords.ts";

async function logIn(browser: Browser, name: "peyton" | "ronja") {
  const context = await browser.newContext({ ...test.info().project.use });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Password").fill(e2ePasswords[name]!);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
  return page;
}

const openShopping = (page: Page) => page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Shopping" }).click();

test("two phones share one list: packs, leftovers, pack size, ticks and extras", async ({ browser }) => {
  const stamp = Date.now();
  const carrots = `Parsnips ${stamp}`;
  const leeks = `Leeks ${stamp}`;
  const milk = `Milk ${stamp}`;
  const onions = `Onions ${stamp}`;
  const peyton = await logIn(browser, "peyton");
  const ronja = await logIn(browser, "ronja");

  // Tonight's dinner, planned through the API (the Week tab is covered by week.spec.ts). Feeds 2, so 2 people eat the amounts as written.
  const made = await peyton.request.post("/api/recipes", {
    data: {
      title: `Parsnip and leek pie ${stamp}`,
      feeds: 2,
      types: ["Vegetarian"],
      tags: [],
      ageFromMonths: null,
      ageToMonths: null,
      lines: [
        { amount: 400, unit: "g", ingredient: carrots, note: "" },
        { amount: 300, unit: "g", ingredient: leeks, note: "" },
        { amount: 2, unit: "pcs", ingredient: onions, note: "" },
      ],
      steps: [],
    },
  });
  const { id } = (await made.json()) as { id: string };
  const [carrot] = (await (await peyton.request.get(`/api/ingredients?q=${encodeURIComponent(carrots)}`)).json()) as { id: string }[];
  await peyton.request.put(`/api/ingredients/${carrot!.id}`, { data: { shopSection: "Vegetables", packAmount: 1, packUnit: "kg", alwaysAtHome: false } });
  const today = await peyton.evaluate(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  await peyton.request.put(`/api/plan/days/${today}`, { data: { dinnerRecipeId: id, people: 2 } });

  await openShopping(peyton);
  await openShopping(ronja);

  const carrotLine = (page: Page) => page.getByRole("listitem").filter({ has: page.getByRole("checkbox", { name: new RegExp(carrots) }) });
  await expect(carrotLine(peyton)).toContainText("Buy 1 pack (1 kg)");
  await expect(carrotLine(peyton)).toContainText("You need 400 g · 600 g left over");

  // New ingredients get a guessed shop section. Onions are counted, so they never ask for a pack size.
  const vegetables = peyton.getByRole("region", { name: "Vegetables" });
  const onionLine = vegetables.getByRole("listitem").filter({ has: peyton.getByRole("checkbox", { name: new RegExp(onions) }) });
  await expect(onionLine).toContainText("2");
  await expect(onionLine.getByRole("button", { name: "Set pack size" })).toHaveCount(0);

  // Leeks have no pack size yet, so the list asks for one.
  const leekLine = peyton.getByRole("listitem").filter({ has: peyton.getByRole("checkbox", { name: new RegExp(leeks) }) });
  await leekLine.getByRole("button", { name: "Set pack size" }).click();
  const packForm = leekLine.getByRole("form", { name: `Pack size for ${leeks}` });
  await packForm.getByLabel("Pack size").fill("500");
  await packForm.getByLabel("Unit").selectOption("g");
  await packForm.getByRole("button", { name: "Save" }).click();
  await expect(leekLine).toContainText("Buy 1 pack (500 g)");
  await expect(leekLine).toContainText("You need 300 g · 200 g left over");
  await expect(leekLine.getByRole("button", { name: "Set pack size" })).toBeHidden();

  // Onions move to Other right from the list, and stay there.
  await onionLine.getByLabel(`Move ${onions} to another shop section`).selectOption("Other");
  await expect(peyton.getByRole("region", { name: "Other" }).getByRole("checkbox", { name: new RegExp(onions) })).toBeVisible();
  await expect(vegetables.getByRole("checkbox", { name: new RegExp(onions) })).toHaveCount(0);

  // Peyton ticks the parsnips in the shop; Ronja's phone shows it within 5 s.
  await peyton.getByRole("checkbox", { name: new RegExp(carrots) }).click();
  await expect(peyton.getByRole("checkbox", { name: new RegExp(carrots) })).toBeChecked();
  await expect(ronja.getByRole("checkbox", { name: new RegExp(carrots) })).toBeChecked({ timeout: 5000 });

  // Ronja adds milk; Peyton sees it.
  await ronja.getByLabel("Add something").fill(milk);
  await ronja.getByRole("button", { name: "Add", exact: true }).click();
  await expect(ronja.getByRole("checkbox", { name: milk })).toBeVisible();
  await expect(peyton.getByRole("checkbox", { name: milk })).toBeVisible({ timeout: 5000 });
  await expect(ronja.getByRole("checkbox", { name: new RegExp(leeks) })).toBeVisible();
  await ronja.screenshot({ path: ".peystack/shots/p6-list.png", fullPage: true });

  // Clear ticked takes the parsnips off both lists.
  await ronja.getByRole("button", { name: "Clear ticked" }).click();
  await expect(ronja.getByRole("checkbox", { name: new RegExp(carrots) })).toBeHidden();
  await expect(peyton.getByRole("checkbox", { name: new RegExp(carrots) })).toBeHidden({ timeout: 5000 });
  await ronja.getByRole("button", { name: "Bring back" }).click();
  await expect(ronja.getByRole("checkbox", { name: new RegExp(carrots) })).not.toBeChecked();

  await peyton.context().close();
  await ronja.context().close();
});
