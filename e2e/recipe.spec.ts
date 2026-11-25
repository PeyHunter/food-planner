import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { e2ePasswords } from "./passwords.ts";

const photo = async (name: string, colour: string) => ({
  name,
  mimeType: "image/jpeg",
  buffer: await sharp({ create: { width: 2400, height: 1800, channels: 3, background: colour } }).jpeg().toBuffer(),
});

async function logIn(page: Page) {
  await page.goto("/");
  await page.getByLabel("Name").fill("peyton");
  await page.getByLabel("Password").fill(e2ePasswords.peyton);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Recipes" }).click();
  await expect(page.getByRole("heading", { name: "What shall we cook?", level: 2 })).toBeVisible();
}

const shownImage = (page: Page, name: string) =>
  expect.poll(() => page.getByRole("img", { name, exact: true }).first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0);

test("add a recipe with a photo, step 4 to 6 people, then log that I made it", async ({ page }) => {
  const title = `Fish pie ${Date.now()}`;
  await logIn(page);

  await page.getByRole("link", { name: "+ Add recipe" }).click();
  await page.getByLabel("Name").fill(title);
  await expect(page.getByLabel("Feeds (people)")).toHaveValue("4");
  await page.getByLabel("Time (minutes)").fill("75");
  await page.getByRole("button", { name: "Fish" }).click();
  await page.getByRole("button", { name: "kid-friendly" }).click();

  const lines = [
    ["3", "pcs", "Onion", "finely chopped"],
    ["130", "g", "Butter", ""],
    ["2.5", "ml", "Salt", ""],
  ];
  for (const [index, [amount, unit, ingredient, note]] of lines.entries()) {
    const n = index + 1;
    if (n > 1) await page.getByRole("button", { name: "+ Add ingredient" }).click();
    await page.getByLabel(`Amount ${n}`).fill(amount!);
    await page.getByLabel(`Unit ${n}`).selectOption(unit!);
    await page.getByLabel(`Ingredient ${n}`).fill(ingredient!);
    if (note) await page.getByLabel(`Note ${n}`).fill(note);
  }
  await page.getByLabel("Step 1").fill("Fry the onion in the butter.");
  await page.getByLabel("Main photo").setInputFiles(await photo("pie.jpg", "#e8a33c"));
  await page.getByRole("button", { name: "Save recipe" }).click();

  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await shownImage(page, title);
  const amounts = page.locator(".lines .amount");
  await expect(amounts).toHaveText(["3 pcs", "130 g", "2.5 ml"]);
  await expect(page.getByText("Takes 1 h 15 min")).toBeVisible();
  await expect(page.locator(".lines")).toContainText("Onion, finely chopped");

  await page.getByRole("button", { name: "More people" }).click();
  await page.getByRole("button", { name: "More people" }).click();
  await expect(page.getByText("Feeds 6")).toBeVisible();
  // 4.5 onions → 5, 195 g → 200 g, 3.75 ml → 4 ml
  await expect(amounts).toHaveText(["5 pcs", "200 g", "4 ml"]);
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT, fullPage: true });

  await page.getByRole("button", { name: "I made this" }).click();
  await page.getByLabel("Photos from this time (if you like)").setInputFiles([await photo("cook.jpg", "#3c8ee8")]);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(/^Made once, last on /)).toBeVisible();
  await expect(page.locator(".cooks li")).toHaveText([/by Peyton \(1 photo\)$/]);
  await shownImage(page, "Recipe photo");
  await expect(page.getByText("Feeds 6")).toBeVisible();

  await page.reload();
  await expect(page.getByText("Feeds 4")).toBeVisible();
  await expect(page.getByText(/^Made once/)).toBeVisible();

  await page.getByRole("link", { name: "Back to recipes" }).click();
  await page.getByLabel("Search recipes").fill("butter");
  await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible();
  await page.getByLabel("Search recipes").fill("no such dish");
  await expect(page.getByText('No recipe matches "no such dish".')).toBeVisible();
});

test("typing an ingredient suggests ones the kitchen already has", async ({ page, request }) => {
  await logIn(page);
  const made = await page.request.post("/api/recipes", {
    data: { title: "Carrot soup", feeds: 2, types: ["Vegetables"], tags: [], lines: [{ amount: 500, unit: "g", ingredient: "Carrots", note: "" }], steps: [] },
  });
  expect(made.status()).toBe(201);
  expect((await request.get("/api/ingredients?q=car")).status()).toBe(401);

  await page.getByRole("link", { name: "+ Add recipe" }).click();
  await page.getByLabel("Ingredient 1").fill("carr");
  await page.getByRole("list", { name: "Suggestions for ingredient 1" }).getByRole("button", { name: "Carrots" }).click();
  await expect(page.getByLabel("Ingredient 1")).toHaveValue("Carrots");
  await expect(page.getByRole("list", { name: "Suggestions for ingredient 1" })).toBeHidden();
});

test("each ingredient shows its guessed shop section, and offers a fix for a name it doesn't know", async ({ page }) => {
  await logIn(page);
  await page.getByRole("link", { name: "+ Add recipe" }).click();
  const hint = page.getByLabel("Shop section, line 1");

  await page.getByLabel("Ingredient 1").fill("2 dl piskefløde");
  await expect(hint).toContainText("Dairy");
  await expect(hint.getByRole("button")).toHaveCount(0);

  await page.getByLabel("Ingredient 1").fill("brocoli");
  await expect(hint).toContainText("Did you mean:");
  await hint.getByRole("button", { name: "broccoli?" }).click();
  await expect(page.getByLabel("Ingredient 1")).toHaveValue("broccoli");
  await expect(hint).toHaveText("Vegetables");

  await page.getByLabel("Ingredient 1").fill("hvidløgsfed");
  await expect(hint).toHaveText("Vegetables");
  await page.getByLabel("Ingredient 1").fill("mozarella");
  await expect(hint.getByRole("button", { name: "mozzarella?" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
});

test("saving with a big photo on a slow line shows how much of the photo is sent", async ({ page }) => {
  await logIn(page);
  await page.getByRole("link", { name: "+ Add recipe" }).click();
  await page.getByLabel("Name").fill("Slow upload pie");
  await page.getByRole("button", { name: "Fish" }).click();
  const noise = await sharp(Buffer.from(Array.from({ length: 900 * 700 * 3 }, () => Math.floor(Math.random() * 256))), { raw: { width: 900, height: 700, channels: 3 } })
    .jpeg({ quality: 95 })
    .toBuffer();
  await page.getByLabel("Main photo").setInputFiles({ name: "big.jpg", mimeType: "image/jpeg", buffer: noise });

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: 200 * 1024 });
  await page.getByRole("button", { name: "Save recipe" }).click();
  await expect(page.getByRole("button", { name: /^Uploading photo… [1-9]\d?%$/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Slow upload pie" })).toBeVisible({ timeout: 30_000 });
});

test("a link to a recipe opened while logged out lands on that recipe after logging in", async ({ page, browser }) => {
  await logIn(page);
  const made = await page.request.post("/api/recipes", { data: { title: "Deep link stew", feeds: 2, types: ["Meat"], tags: [], lines: [], steps: [] } });
  const { id } = (await made.json()) as { id: string };

  const fresh = await browser.newPage();
  await fresh.goto(`/#/recipes/${id}`);
  await fresh.getByLabel("Name").fill("peyton");
  await fresh.getByLabel("Password").fill(e2ePasswords.peyton);
  await fresh.getByRole("button", { name: "Log in" }).click();
  await expect(fresh.getByRole("heading", { name: "Deep link stew" })).toBeVisible();
  const recipesTab = fresh.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Recipes" });
  await expect(recipesTab).toHaveAttribute("aria-current", "page");

  // The same link opened in an app that is already showing another tab.
  await fresh.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Week" }).click();
  await expect(fresh.getByRole("heading", { name: "Deep link stew" })).toBeHidden();
  await fresh.goto(`/#/recipes/${id}`);
  await expect(fresh.getByRole("heading", { name: "Deep link stew" })).toBeVisible();
  await expect(recipesTab).toHaveAttribute("aria-current", "page");

  // Logged out on a page that is already open, then the link, then logging in.
  await fresh.getByRole("link", { name: "Profile" }).click();
  await fresh.getByRole("button", { name: "Log out", exact: true }).click();
  // Wait for the login screen: logging out resets the address to #/home once the server answers, and that must not land after the link below.
  await expect(fresh.getByLabel("Name")).toBeVisible();
  await fresh.goto("/#/week");
  await fresh.goto(`/#/recipes/${id}`);
  await fresh.getByLabel("Name").fill("peyton");
  await fresh.getByLabel("Password").fill(e2ePasswords.peyton);
  await fresh.getByRole("button", { name: "Log in" }).click();
  await expect(fresh.getByRole("heading", { name: "Deep link stew" })).toBeVisible();
  await fresh.close();
});

test("an amount never picks a unit by itself: 1 dild asks for one instead of becoming 1 g", async ({ page }) => {
  await logIn(page);
  const title = `Dild ${Date.now()}`;
  await page.getByRole("link", { name: "+ Add recipe" }).click();
  await page.getByLabel("Name").fill(title);
  await page.getByRole("button", { name: "Fish" }).click();
  await page.getByLabel("Amount 1").fill("1");
  await expect(page.getByLabel("Unit 1")).toHaveValue("");
  await page.getByLabel("Ingredient 1").fill("dild");
  await page.getByRole("button", { name: "Save recipe" }).click();
  await expect(page.getByRole("alert")).toHaveText("Pick a unit for dild.");
  await page.getByLabel("Unit 1").selectOption("pcs");
  await page.getByRole("button", { name: "Save recipe" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.locator(".lines .amount")).toHaveText(["1 pcs"]);
});
