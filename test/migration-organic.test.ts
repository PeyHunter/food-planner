import { randomUUID } from "node:crypto";
import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";
import { migrate as runMigrations } from "drizzle-orm/node-postgres/migrator";
import { expect, inject, test } from "vitest";
import { connectDatabase, migrate } from "../src/server/db.ts";

// 0011 turns nemlig_organic from a yes/no into "none" | "produce" | "all"; old kitchens must keep their choice.
test("the organic setting moves over: yes becomes everything, no becomes none", async () => {
  const name = `test_${randomUUID().replaceAll("-", "")}`;
  const admin = new pg.Client({ connectionString: `${inject("postgresUrl")}/postgres` });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();
  const database = connectDatabase(`${inject("postgresUrl")}/${name}`);

  const before = await mkdtemp(join(inject("scratchDir"), "drizzle-0010-"));
  await cp("drizzle", before, { recursive: true });
  const journal = JSON.parse(await readFile(join(before, "meta/_journal.json"), "utf8"));
  journal.entries = journal.entries.filter((entry: { idx: number }) => entry.idx <= 10);
  await writeFile(join(before, "meta/_journal.json"), JSON.stringify(journal));
  await runMigrations(database.db, { migrationsFolder: before });

  const query = async (text: string) => (await database.db.$client.query(text)).rows;
  await query(`INSERT INTO kitchens (name, nemlig_organic) VALUES ('yes', true), ('no', false)`);
  await migrate(database);

  expect(await query(`SELECT name, nemlig_organic FROM kitchens ORDER BY name`)).toEqual([
    { name: "no", nemlig_organic: "none" },
    { name: "yes", nemlig_organic: "all" },
  ]);
  await query(`INSERT INTO kitchens (name) VALUES ('new')`);
  expect(await query(`SELECT nemlig_organic FROM kitchens WHERE name = 'new'`)).toEqual([{ nemlig_organic: "none" }]);
  await database.close();
});
