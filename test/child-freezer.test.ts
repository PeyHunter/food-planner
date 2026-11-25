import { randomUUID } from "node:crypto";
import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";
import { migrate as runMigrations } from "drizzle-orm/node-postgres/migrator";
import { expect, inject, test } from "vitest";
import { connectDatabase, migrate } from "../src/server/db.ts";
import type { RecipeInput } from "../src/shared/recipes.ts";
import type { FreezerItem, WeekView } from "../src/shared/week.ts";
import { createTestApp, startingUsers } from "./support/test-app.ts";

// The test clock says 2026-03-01, a Sunday.
const monday = "2026-03-02";

const recipe = (title: string, extra: Partial<RecipeInput> = {}): RecipeInput => ({
  title,
  feeds: 4,
  types: ["Fish"],
  tags: ["freezable"],
  ageFromMonths: null,
  ageToMonths: null,
  lines: [],
  steps: [],
  ...extra,
});

async function loggedIn() {
  const app = await createTestApp();
  const { cookie } = await app.logIn(startingUsers[0]!.username, startingUsers[0]!.password);
  const call = (path: string, method = "GET", body?: unknown) =>
    app.request(path, {
      method,
      headers: { cookie: cookie!, ...(body === undefined ? {} : { "content-type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const create = async (input: RecipeInput) => ((await (await call("/api/recipes", "POST", input)).json()) as { id: string }).id;
  const weekView = async () => (await (await call(`/api/plan/weeks/${monday}`)).json()) as WeekView;
  const childFreezer = async (childId: string) => (await (await call(`/api/children/${childId}/freezer`)).json()) as FreezerItem[];
  const countOf = async (childId: string, recipeId: string) => (await childFreezer(childId)).find((item) => item.recipe.id === recipeId)?.count ?? 0;
  return { app, call, create, weekView, childFreezer, countOf };
}

test("her freezer holds portions, the week plans a meal from it, and clearing gives the portion back", async () => {
  const { call, create, weekView, childFreezer, countOf } = await loggedIn();
  const mash = await create(recipe("Runi mash"));
  const runi = (await weekView()).children[0]!.id;

  expect(await (await call(`/api/children/${runi}/freezer/${mash}`, "POST", { add: 2 })).json()).toEqual({ count: 2 });
  expect(await childFreezer(runi)).toMatchObject([{ recipe: { id: mash, title: "Runi mash", tags: ["freezable"] }, count: 2 }]);

  expect((await call(`/api/plan/days/${monday}/children/${runi}`, "PUT", { kind: "recipe", recipeId: mash, fromFreezer: true })).status).toBe(204);
  expect(await countOf(runi, mash)).toBe(1);
  let view = await weekView();
  expect(view.days[0]!.children[0]).toMatchObject({ kind: "recipe", fromFreezer: true, recipe: { id: mash } });
  expect(view.childFreezer[runi]).toMatchObject([{ recipe: { id: mash }, count: 1 }]);

  expect((await call(`/api/plan/days/${monday}/children/${runi}`, "PUT", { kind: "empty" })).status).toBe(204);
  expect(await countOf(runi, mash)).toBe(2);
  view = await weekView();
  expect(view.days[0]!.children[0]).toMatchObject({ kind: "empty", fromFreezer: false });

  // Empty it, then planning from it changes nothing and says so.
  await call(`/api/children/${runi}/freezer/${mash}`, "POST", { add: -2 });
  const response = await call(`/api/plan/days/${monday}/children/${runi}`, "PUT", { kind: "recipe", recipeId: mash, fromFreezer: true });
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: "None of that dish is left in her freezer." });
  expect((await weekView()).days[0]!.children[0]!.kind).toBe("empty");
  expect(await countOf(runi, mash)).toBe(0);
});

test("a child freezer only takes this kitchen's child and recipes", async () => {
  const { app, call, create, weekView } = await loggedIn();
  const mash = await create(recipe("Mash"));
  const runi = (await weekView()).children[0]!.id;
  const [kitchen] = await app.query<{ id: string }>("insert into kitchens (name) values ('Other kitchen') returning id");
  const [other] = await app.query<{ id: string }>("insert into recipes (kitchen_id, title, feeds) values ($1, 'Other pie', 4) returning id", [kitchen!.id]);
  const [otherChild] = await app.query<{ id: string }>("insert into children (kitchen_id, name) values ($1, 'Other kid') returning id", [kitchen!.id]);

  expect((await call(`/api/children/${runi}/freezer/${other!.id}`, "POST", { add: 1 })).status).toBe(404);
  expect((await call(`/api/children/${otherChild!.id}/freezer`)).status).toBe(404);
  expect((await call(`/api/plan/days/${monday}/children/${runi}`, "PUT", { kind: "recipe", recipeId: other!.id })).status).toBe(404);

  for (const add of [0, 1.5, 51]) expect((await call(`/api/children/${runi}/freezer/${mash}`, "POST", { add })).status).toBe(400);
});

test("a child's recipe in the kitchen freezer shows in her freezer, not the kitchen's, and comes first in her picks", async () => {
  const { app, call, create, weekView, childFreezer } = await loggedIn();
  const forRuni = await create(recipe("Leverpostej", { tags: ["freezable", "for Runi"] }));
  const runi = (await weekView()).children[0]!.id;
  await app.query("insert into freezer_portions (kitchen_id, recipe_id, count) select kitchen_id, id, 4 from recipes where id = $1", [forRuni]);
  // Her own freezer takes it the way the recipe page now puts it.
  expect(await (await call(`/api/children/${runi}/freezer/${forRuni}`, "POST", { add: 4 })).json()).toEqual({ count: 4 });
  expect((await weekView()).freezer).toEqual([]);
  expect(await childFreezer(runi)).toMatchObject([{ recipe: { id: forRuni }, count: 4 }]);
});

// 0016 moves a child recipe's kitchen portions into the child's freezer, when the kitchen has exactly one child.
test("the migration moves child recipes out of the kitchen freezer into the only child's freezer, and fixes the Anna A typo", async () => {
  const name = `test_${randomUUID().replaceAll("-", "")}`;
  const admin = new pg.Client({ connectionString: `${inject("postgresUrl")}/postgres` });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();
  const database = connectDatabase(`${inject("postgresUrl")}/${name}`);

  const before = await mkdtemp(join(inject("scratchDir"), "drizzle-0015-"));
  await cp("drizzle", before, { recursive: true });
  const journal = JSON.parse(await readFile(join(before, "meta/_journal.json"), "utf8"));
  journal.entries = journal.entries.filter((entry: { idx: number }) => entry.idx <= 15);
  await writeFile(join(before, "meta/_journal.json"), JSON.stringify(journal));
  await runMigrations(database.db, { migrationsFolder: before });

  const query = async (text: string, values: unknown[] = []) => (await database.db.$client.query(text, values)).rows;
  const [one] = await query(`INSERT INTO kitchens (name) VALUES ('One kid') RETURNING id`);
  const [two] = await query(`INSERT INTO kitchens (name) VALUES ('Two kids') RETURNING id`);
  const [anna] = await query(`INSERT INTO kitchens (name) VALUES ('Anna D and Jacob''s kitchen') RETURNING id`);
  const [kid] = await query(`INSERT INTO children (kitchen_id, name) VALUES ($1, 'Runi') RETURNING id`, [one!.id]);
  await query(`INSERT INTO children (kitchen_id, name) VALUES ($1, 'Vilje'), ($1, 'Konrad')`, [two!.id]);
  const recipe = async (kitchen: string, title: string, tag: string | null, ageFrom: number | null) => {
    const [row] = await query(`INSERT INTO recipes (kitchen_id, title, feeds, age_from_months) VALUES ($1, $2, 2, $3) RETURNING id`, [kitchen, title, ageFrom]);
    if (tag) await query(`INSERT INTO recipe_tags (recipe_id, tag) VALUES ($1, $2)`, [row!.id, tag]);
    return row!.id as string;
  };
  const tagged = await recipe(one!.id, "Leverpostej", "for Runi", null);
  const aged = await recipe(one!.id, "Baby mash", null, 6);
  const grownUp = await recipe(one!.id, "Fish pie", "freezable", null);
  const twoKidsTagged = await recipe(two!.id, "Leverpostej", "for Runi", null);
  await query(`INSERT INTO freezer_portions (kitchen_id, recipe_id, count) VALUES ($1, $2, 4), ($1, $3, 1), ($1, $4, 2), ($5, $6, 3)`, [one!.id, tagged, aged, grownUp, two!.id, twoKidsTagged]);
  await query(`INSERT INTO child_freezer_portions (child_id, recipe_id, count) VALUES ($1, $2, 1)`, [kid!.id, tagged]);
  await query(`INSERT INTO users (username, password_hash, display_name) VALUES ('annaa', 'x', 'Anna D'), ('jacob', 'x', null)`);
  await query(`UPDATE kitchens SET name = 'Anna D and Jacob''s kitchen' WHERE id = $1`, [anna!.id]);

  await migrate(database);
  // Running the file again changes nothing: the rows it would move are already gone.
  const sql = await readFile("drizzle/0016_runi_freezer_home.sql", "utf8");
  await database.db.$client.query(sql);

  const kitchenFreezer = await query(`SELECT kitchen_id, recipe_id, count FROM freezer_portions ORDER BY count`);
  expect(kitchenFreezer).toHaveLength(2);
  expect(kitchenFreezer).toContainEqual({ kitchen_id: one!.id, recipe_id: grownUp, count: 2 });
  expect(kitchenFreezer).toContainEqual({ kitchen_id: two!.id, recipe_id: twoKidsTagged, count: 3 });
  expect(await query(`SELECT count, recipe_id FROM child_freezer_portions WHERE child_id = $1 ORDER BY count`, [kid!.id])).toEqual([
    { count: 1, recipe_id: aged },
    { count: 5, recipe_id: tagged },
  ]);
  expect(await query(`SELECT display_name FROM users WHERE username = 'annaa'`)).toEqual([{ display_name: "Anna A" }]);
  expect(await query(`SELECT name FROM kitchens WHERE id = $1`, [anna!.id])).toEqual([{ name: "Anna A and Jacob's kitchen" }]);
  await database.close();
});
