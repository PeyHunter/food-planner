import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { addDays, mondayOf } from "../src/shared/week.ts";
import { e2ePasswords } from "./passwords.ts";

/** Rules, swap ideas, Create week and Reduce waste sit behind the Suggestions button, closed at first. */
async function openSuggestions(page: Page) {
  const toggle = page.getByRole("button", { name: /^Suggestions/ });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("button", { name: "Create week" })).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
}

const recipe = (title: string, types: string[], tags: string[]) => ({ title, feeds: 4, types, tags, ageFromMonths: null, ageToMonths: null, lines: [], steps: [] });

test("plan a fish dinner, set Wednesday to 5, mash it for Runi and take a swap", async ({ page, browserName }) => {
  test.skip(browserName === "webkit", "Playwright's Linux WebKit stops drawing after selectOption in the rules sheet; Chromium covers it");
  const stamp = Date.now();
  const salmon = `Salmon bake ${stamp}`;
  const mash = `Cod mash ${stamp}`;

  await page.goto("/");
  await page.getByLabel("Name").fill("peyton");
  await page.getByLabel("Password").fill(e2ePasswords.peyton);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Week" })).toHaveAttribute("aria-current", "page");

  // Recipes come in through the API; adding them in the form is covered by recipe.spec.ts.
  const made = await page.request.post("/api/recipes", { data: recipe(salmon, ["Fish"], ["freezable"]) });
  const { id } = (await made.json()) as { id: string };
  const jpeg = await sharp({ create: { width: 600, height: 600, channels: 3, background: "#f08a5d" } }).jpeg().toBuffer();
  await page.request.post(`/api/recipes/${id}/photos`, { multipart: { role: "main", photo: { name: "salmon.jpg", mimeType: "image/jpeg", buffer: jpeg } } });
  await page.request.post("/api/recipes", { data: recipe(mash, ["Fish"], ["for Runi"]) });

  // This week has a "next up" day; plan next week so no day is in the past.
  await expect(page.getByText("Next up")).toBeVisible();
  await page.getByRole("button", { name: "Next week" }).click();
  await expect(page.getByText("Next up")).toBeHidden();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: process.env.CLOSED_SHOT ?? "test-results/week-closed.png" });
  await openSuggestions(page);

  const wednesday = page.getByRole("listitem", { name: "Wednesday" });
  await wednesday.getByRole("button", { name: "+ Pick a dinner" }).click();
  const sheet = page.getByRole("dialog", { name: "Dinner for Wednesday" });
  await sheet.getByLabel("Search recipes").fill(salmon);
  const types = sheet.getByRole("group", { name: "Filter by type" });
  await types.getByRole("button", { name: "Meat" }).click();
  await expect(sheet.getByText("No recipe matches.")).toBeVisible();
  await types.getByRole("button", { name: "Fish" }).click();
  await expect(types.getByRole("button", { name: "Fish" })).toHaveAttribute("aria-pressed", "true");
  await expect(sheet.getByRole("button", { name: new RegExp(salmon) })).toContainText("Fish");
  await page.screenshot({ path: process.env.PICKER_SHOT ?? "test-results/week-picker.png" });
  await sheet.getByRole("button", { name: new RegExp(salmon) }).click();
  await expect(sheet).toBeHidden();
  await expect(wednesday.getByText(salmon)).toBeVisible();
  await expect(page.getByLabel(/^Adults: Fish at least 1 a week: \d so far, met$/)).toBeVisible();

  // Tapping the planned dinner opens its recipe, with "I made this"; the back arrow returns to the same week.
  const weekTitle = await page.locator(".wk-title h2").textContent();
  await wednesday.getByRole("link", { name: new RegExp(salmon) }).click();
  await expect(page.getByRole("heading", { name: salmon, level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "I made this" })).toBeVisible();
  await page.getByRole("link", { name: "Back to the week" }).click();
  await expect(page.locator(".wk-title h2")).toHaveText(weekTitle!);
  await wednesday.getByRole("button", { name: "Change dinner on Wednesday" }).click();
  await expect(page.getByRole("dialog", { name: "Dinner for Wednesday" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();

  for (let step = 0; step < 3; step++) await wednesday.getByRole("button", { name: "One more person on Wednesday" }).click();
  await expect(wednesday.getByRole("group", { name: "People on Wednesday" })).toContainText("5");

  await wednesday.getByRole("button", { name: /Runi Lee/ }).click();
  await page.getByRole("dialog", { name: "Runi Lee on Wednesday" }).getByRole("button", { name: "Same as dinner, mashed" }).click();
  await expect(wednesday.getByRole("button", { name: /Runi Lee/ })).toContainText("Same as dinner, mashed");
  await expect(wednesday.getByRole("group", { name: "People on Wednesday" })).toContainText("+½");
  await expect(page.getByLabel("Runi Lee: Fish at least 2 a week: 1 so far, not met yet")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Suggestions/ }).getByLabel(/ideas to meet the rules$/)).toBeVisible();

  const swap = page.getByRole("button", { name: /^Let's do it: Add .* on Runi Lee's Monday to get fish 2\/2$/ });
  await swap.click();
  await expect(page.getByLabel(/^Runi Lee: Fish at least 2 a week: \d so far, met$/)).toBeVisible();

  await page.getByRole("button", { name: "Edit rules" }).click();
  const rules = page.getByRole("dialog", { name: "Edit rules" });
  await rules.getByRole("button", { name: "+ Add a rule" }).click();
  // A new rule starts as the adults' third rule: "Adults: Fish at least 1 a week".
  await expect(rules.getByRole("listitem")).toHaveCount(6);
  await rules.getByLabel("What 3").selectOption("Chicken");
  await rules.getByLabel("At least or at most 3").selectOption("at-most");
  await rules.getByLabel("Who 3").selectOption({ label: "Runi Lee" });
  await expect(rules.getByRole("button", { name: "Remove rule: Runi Lee: Chicken at most 1 a week" })).toBeVisible();
  await rules.getByRole("button", { name: "Close" }).click();
  await expect(page.getByLabel("Runi Lee: Chicken at most 1 a week: 0 so far, met")).toBeVisible();

  await page.getByRole("button", { name: "Edit rules" }).click();
  await rules.getByRole("button", { name: "Remove rule: Runi Lee: Chicken at most 1 a week" }).click();
  await rules.getByRole("button", { name: "Close" }).click();
  await expect(page.getByLabel(/Chicken/)).toHaveCount(0);

  await page.reload();
  await page.getByRole("button", { name: "Next week" }).click();
  await expect(page.getByRole("listitem", { name: "Wednesday" }).getByText(salmon)).toBeVisible();
  // Open stays open after a reload.
  await expect(page.getByRole("button", { name: /^Suggestions/ })).toHaveAttribute("aria-expanded", "true");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: process.env.WEEK_SHOT ?? "test-results/week.png", fullPage: true });
});

test("quick taps on people all count, stickers fit, and mashing needs a dinner", async ({ page }) => {
  const veg = `Big vegetable tray bake ${Date.now()}`;
  await page.goto("/");
  await page.getByLabel("Name").fill("ronja");
  await page.getByLabel("Password").fill(e2ePasswords.ronja);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "Hi Ronja" })).toBeVisible();
  const made = await page.request.post("/api/recipes", { data: recipe(veg, ["Vegetables", "Vegetarian", "Chicken"], ["freezable", "kid-friendly"]) });
  expect(made.ok()).toBe(true);

  // Two weeks ahead, so this test never shares a day with the one above.
  await page.getByRole("button", { name: "Next week" }).click();
  await page.getByRole("button", { name: "Next week" }).click();
  const thursday = page.getByRole("listitem", { name: "Thursday" });
  const people = thursday.getByRole("group", { name: "People on Thursday" });
  await expect(people).toContainText("2");

  // Three taps in the same moment, before any answer comes back.
  const saved = page.waitForResponse((response) => response.request().method() === "PUT" && response.url().includes("/api/plan/days/"));
  await thursday.getByRole("button", { name: "One more person on Thursday" }).evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
    button.click();
  });
  await expect(people).toContainText("5");
  expect((await saved).request().postDataJSON()).toEqual({ people: 5 });
  await page.reload();
  await page.getByRole("button", { name: "Next week" }).click();
  await page.getByRole("button", { name: "Next week" }).click();
  await expect(people).toContainText("5");

  await thursday.getByRole("button", { name: /Runi Lee/ }).click();
  const sheet = page.getByRole("dialog", { name: "Runi Lee on Thursday" });
  await expect(sheet.getByRole("button", { name: "Same as dinner, mashed" })).toBeDisabled();
  await expect(sheet.getByText("Pick a dinner first")).toBeVisible();
  await sheet.getByRole("button", { name: "Close" }).click();

  await thursday.getByRole("button", { name: "+ Pick a dinner" }).click();
  const dinner = page.getByRole("dialog", { name: "Dinner for Thursday" });
  await dinner.getByLabel("Search recipes").fill(veg);
  await dinner.getByRole("button", { name: new RegExp(veg) }).click();
  await expect(thursday.getByText(veg)).toBeVisible();

  for (const width of [375, 393]) {
    await page.setViewportSize({ width, height: 800 });
    const overflow = await thursday.evaluate((card) => {
      const box = card.getBoundingClientRect();
      return [...card.querySelectorAll<HTMLElement>(".sticker")]
        .filter((sticker) => {
          const own = sticker.getBoundingClientRect();
          return sticker.scrollWidth > sticker.clientWidth + 1 || own.right > box.right || own.left < box.left;
        })
        .map((sticker) => sticker.textContent);
    });
    expect(overflow, `stickers that spill at ${width}px`).toEqual([]);
  }
  await page.setViewportSize({ width: 375, height: 800 });
  await thursday.screenshot({ path: process.env.STICKER_SHOT ?? "test-results/week-stickers.png" });
});

test("Create week fills only the empty days, ticks the rules, and undo puts them back", async ({ page }) => {
  const stamp = Date.now();
  await page.goto("/");
  await page.getByLabel("Name").fill("peyton");
  await page.getByLabel("Password").fill(e2ePasswords.peyton);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Next up")).toBeVisible();

  // Four weeks ahead: no other test plans that week, and no day is past.
  const monday = addDays(mondayOf(new Date().toLocaleDateString("en-CA")), 28);
  const post = async (data: ReturnType<typeof recipe>) => ((await (await page.request.post("/api/recipes", { data })).json()) as { id: string }).id;
  const pie = await post(recipe(`Fish pie ${stamp}`, ["Fish"], ["freezable"]));
  const curry = await post(recipe(`Pea curry ${stamp}`, ["Vegetarian"], []));
  for (const name of ["Tacos", "Dal", "Soup", "Risotto", "Stew"]) await post(recipe(`${name} ${stamp}`, ["Vegetarian"], []));
  for (const name of ["Cod", "Salmon"]) await post(recipe(`${name} and pea mash ${stamp}`, ["Fish", "Vegetables"], ["for Runi"]));
  for (const name of ["Carrot", "Squash", "Broccoli", "Parsnip", "Pumpkin"]) await post(recipe(`${name} mash ${stamp}`, ["Vegetables"], ["for Runi"]));
  await page.request.put(`/api/plan/days/${monday}`, { data: { dinnerRecipeId: pie } });
  await page.request.put(`/api/plan/days/${addDays(monday, 2)}`, { data: { dinnerRecipeId: curry } });

  for (let week = 0; week < 4; week++) await page.getByRole("button", { name: "Next week" }).click();
  await expect(page.getByRole("listitem", { name: "Wednesday" })).toContainText(`Pea curry ${stamp}`);
  await expect(page.getByRole("button", { name: "+ Pick a dinner" })).toHaveCount(5);

  await openSuggestions(page);
  await page.getByRole("button", { name: "Create week" }).click();
  const note = page.getByRole("region", { name: "Create week" }).getByRole("status");
  await expect(note).toContainText("Filled 5 dinners and 7 meals for Runi Lee.");
  // Other tests add recipes to the same kitchen, so counts can go past the goal.
  await expect(note).toContainText(/Fish \d\/2 for Runi Lee ✓/);
  await expect(page.getByRole("button", { name: "+ Pick a dinner" })).toHaveCount(0);
  await expect(page.getByRole("listitem", { name: "Monday" })).toContainText(`Fish pie ${stamp}`);
  await expect(page.getByRole("listitem", { name: "Wednesday" })).toContainText(`Pea curry ${stamp}`);
  await expect(page.getByText("Nothing yet")).toHaveCount(0);
  await expect(page.getByLabel(/^Adults: Fish at least 1 a week: \d so far, met$/)).toBeVisible();
  await expect(page.getByLabel(/^Runi Lee: Fish at least 2 a week: \d so far, met$/)).toBeVisible();
  await expect(page.getByLabel(/^Runi Lee: Vegetables at least \d a week: \d so far, met$/)).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: process.env.CREATE_SHOT ?? "test-results/create-week.png" });

  await note.getByRole("button", { name: "Undo" }).click();
  await expect(note).toHaveText("");
  await expect(page.getByRole("button", { name: "+ Pick a dinner" })).toHaveCount(5);
  await expect(page.getByText("Nothing yet")).toHaveCount(7);
  await expect(page.getByRole("listitem", { name: "Monday" })).toContainText(`Fish pie ${stamp}`);
  await expect(page.getByRole("listitem", { name: "Wednesday" })).toContainText(`Pea curry ${stamp}`);

  // At 375 px each rule keeps a gap between its name and its count.
  await page.setViewportSize({ width: 375, height: 800 });
  const squeezed = await page.locator(".rule-groups li").evaluateAll((lines) =>
    lines
      .filter((line) => {
        // The text, not its box: a squeezed box lets the word spill over the count.
        const text = document.createRange();
        text.selectNodeContents(line.querySelector(".what")!);
        const what = text.getBoundingClientRect();
        const count = line.querySelector(".count")!.getBoundingClientRect();
        const group = line.closest(".rule-groups > div")!.getBoundingClientRect();
        const sameRow = count.top < what.bottom && what.top < count.bottom;
        return (sameRow && count.left - what.right < 4) || count.right > group.right || what.right > group.right;
      })
      .map((line) => line.textContent),
  );
  expect(squeezed, "rules with no room between name and count").toEqual([]);
  await page.locator(".rules-card").screenshot({ path: process.env.RULES_SHOT ?? "test-results/rules-375.png" });
});

test("Reduce waste suggests a dish for the leftover carrots, and accepting it lowers the leftover on the list", async ({ page }) => {
  // Letters only: the shop catalog reads past digits, so "Onions 1795…" would be the kitchen's onions, not a new ingredient.
  const stamp = Date.now().toString(4).replace(/[0-3]/g, (digit) => "qwxz"[Number(digit)]!);
  const carrots = `Carrots ${stamp}`;
  const soup = `Carrot soup ${stamp}`;
  await page.goto("/");
  await page.getByLabel("Name").fill("peyton");
  await page.getByLabel("Password").fill(e2ePasswords.peyton);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Next up")).toBeVisible();

  // Next week, so the shopping list can show it and no day is past. 400 g of a 1 kg bag on Monday leaves 600 g.
  const monday = addDays(mondayOf(new Date().toLocaleDateString("en-CA")), 7);
  const withCarrots = (title: string, amount: number) => ({ ...recipe(title, ["Vegetarian"], []), feeds: 2, lines: [{ amount, unit: "g", ingredient: carrots, note: "" }] });
  const post = async (data: object) => ((await (await page.request.post("/api/recipes", { data })).json()) as { id: string }).id;
  const cake = await post(withCarrots(`Carrot cake ${stamp}`, 400));
  await post(withCarrots(soup, 300));
  const [carrot] = (await (await page.request.get(`/api/ingredients?q=${encodeURIComponent(carrots)}`)).json()) as { id: string }[];
  await page.request.put(`/api/ingredients/${carrot!.id}`, { data: { shopSection: "Vegetables", packAmount: 1, packUnit: "kg", alwaysAtHome: false } });
  await page.request.put(`/api/plan/days/${monday}`, { data: { dinnerRecipeId: cake, people: 2 } });

  const nav = page.getByRole("navigation", { name: "Main" });
  const carrotLine = page.getByRole("listitem").filter({ has: page.getByRole("checkbox", { name: new RegExp(carrots) }) });
  const nextWeekList = async () => {
    await nav.getByRole("button", { name: "Shopping" }).click();
    await page.getByRole("group", { name: "Which week" }).getByRole("button", { name: "Next week" }).click();
  };
  await nextWeekList();
  await expect(carrotLine).toContainText("600 g left over");

  await nav.getByRole("button", { name: "Week" }).click();
  await page.getByRole("button", { name: "Next week" }).click();
  await openSuggestions(page);
  const idea = page.getByRole("region", { name: "Reduce waste" }).getByRole("status");
  const suggestion = new RegExp(`^(Add ${soup} on \\w+|Swap \\w+ for ${soup}) to use the 600 g ${carrots.toLowerCase()} left from Monday\\.`);
  await page.getByRole("button", { name: "Reduce waste" }).click();
  await expect(idea).toContainText(suggestion);
  await idea.getByRole("button", { name: "Accept" }).click();
  await expect(idea).toContainText("Done.");
  await expect(page.getByText(soup)).toBeVisible();

  // Undo puts the week back; then take it again for real.
  await idea.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText(soup)).toHaveCount(0);
  await page.getByRole("button", { name: "Reduce waste" }).click();
  await expect(idea).toContainText(suggestion);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: process.env.WASTE_SHOT ?? "test-results/reduce-waste.png" });
  await idea.getByRole("button", { name: "Accept" }).click();
  await expect(page.getByText(soup)).toBeVisible();

  await nextWeekList();
  await expect(carrotLine).toContainText("300 g left over");
});
