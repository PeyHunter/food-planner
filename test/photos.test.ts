import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { expect, inject, test } from "vitest";
import type { Photo, Recipe } from "../src/shared/recipes.ts";
import { createTestApp, startingUsers } from "./support/test-app.ts";

const fileOf = (id: string) => join(inject("scratchDir"), `${id}.jpg`);

/** A photo the size an iPhone takes: blurred noise, so it compresses worse than most real ones (about 6 MB at full size). */
async function phonePhoto(width = 4032, height = 3024, orientation?: number) {
  const noise = sharp(randomBytes(width * height * 3), { raw: { width, height, channels: 3 } }).blur(1);
  return (orientation ? noise.withMetadata({ orientation }) : noise).jpeg({ quality: 92 }).toBuffer();
}

async function setUp() {
  const app = await createTestApp();
  const { cookie } = await app.logIn("peyton", startingUsers[0]!.password);
  const headers = { cookie: cookie! };
  const created = await app.request("/api/recipes", {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ title: "Fish pie", feeds: 4, types: ["Fish"], tags: [], lines: [], steps: [] }),
  });
  const recipeId = ((await created.json()) as { id: string }).id;
  const upload = async (bytes: Uint8Array, role: "main" | "gallery") => {
    const form = new FormData();
    form.set("photo", new File([new Uint8Array(bytes)], "IMG_0001.jpg", { type: "image/jpeg" }));
    form.set("role", role);
    return app.request(`/api/recipes/${recipeId}/photos`, { method: "POST", headers, body: form });
  };
  const recipe = async () => (await (await app.request(`/api/recipes/${recipeId}`, { headers })).json()) as Recipe;
  return { app, headers, recipeId, upload, recipe };
}

test("an uploaded photo is shrunk to 1600 px, saved as a small JPEG and served with a long cache", async () => {
  const { app, headers, upload, recipe } = await setUp();

  const response = await upload(await phonePhoto(), "main");
  expect(response.status).toBe(201);
  const photo = (await response.json()) as Photo;
  expect(photo).toMatchObject({ role: "main", url: `/api/photos/${photo.id}.jpg`, cookId: null });

  const stored = await sharp(fileOf(photo.id)).metadata();
  expect([stored.format, stored.width, stored.height]).toEqual(["jpeg", 1600, 1200]);
  const { size } = await stat(fileOf(photo.id));
  expect(size).toBeLessThanOrEqual(400 * 1024);

  const served = await app.request(photo.url, { headers });
  expect(served.status).toBe(200);
  expect(served.headers.get("content-type")).toBe("image/jpeg");
  expect(served.headers.get("cache-control")).toBe("private, max-age=31536000, immutable");
  expect((await served.arrayBuffer()).byteLength).toBe(size);

  expect((await recipe()).mainPhoto?.id).toBe(photo.id);
});

test("a small photo is not blown up, a sideways one is turned upright, and its metadata is dropped", async () => {
  const { upload } = await setUp();
  const photo = (await (await upload(await phonePhoto(400, 200, 6), "gallery")).json()) as Photo;

  const stored = await sharp(fileOf(photo.id)).metadata();
  expect([stored.width, stored.height]).toEqual([200, 400]);
  expect(stored.exif).toBeUndefined();
  expect(stored.orientation).toBeUndefined();
});

test("a new main photo replaces the old one; gallery photos add up", async () => {
  const { app, headers, upload, recipe } = await setUp();
  const first = (await (await upload(await phonePhoto(800, 600), "main")).json()) as Photo;
  const second = (await (await upload(await phonePhoto(800, 600), "main")).json()) as Photo;
  const extra = (await (await upload(await phonePhoto(800, 600), "gallery")).json()) as Photo;

  const now = await recipe();
  expect(now.mainPhoto?.id).toBe(second.id);
  expect(now.photos.map((photo) => [photo.id, photo.role])).toEqual([
    [second.id, "main"],
    [extra.id, "gallery"],
  ]);
  expect(existsSync(fileOf(first.id))).toBe(false);
  expect((await app.request(first.url, { headers })).status).toBe(404);
});

test("a file that isn't a photo is refused", async () => {
  const { upload } = await setUp();
  const response = await upload(new TextEncoder().encode("not a photo"), "main");
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "That file isn't a photo we can read. Try a JPEG or PNG." });
});

test("deleting a photo or its recipe removes the file", async () => {
  const { app, headers, recipeId, upload } = await setUp();
  const one = (await (await upload(await phonePhoto(800, 600), "gallery")).json()) as Photo;
  const two = (await (await upload(await phonePhoto(800, 600), "main")).json()) as Photo;

  expect((await app.request(`/api/photos/${one.id}`, { method: "DELETE", headers })).status).toBe(204);
  expect(existsSync(fileOf(one.id))).toBe(false);

  expect((await app.request(`/api/recipes/${recipeId}`, { method: "DELETE", headers })).status).toBe(204);
  expect(existsSync(fileOf(two.id))).toBe(false);
});

test("photos need a login and stay in their kitchen", async () => {
  const { app, headers, recipeId, upload } = await setUp();
  const photo = (await (await upload(await phonePhoto(800, 600), "main")).json()) as Photo;

  expect((await app.request(photo.url)).status).toBe(401);
  const [other] = await app.query<{ id: string }>("insert into kitchens (name) values ('Next door') returning id");
  await app.query("update recipes set kitchen_id = $1 where id = $2", [other!.id, recipeId]);
  expect((await app.request(photo.url, { headers })).status).toBe(404);
  expect((await app.request(`/api/photos/${photo.id}`, { method: "DELETE", headers })).status).toBe(404);
  expect((await app.request("/api/photos/../../etc/passwd", { headers })).status).toBe(404);
});

test('"I made this" logs the date and adds the photos from that cook to the gallery', async () => {
  const { app, headers, recipeId, recipe } = await setUp();
  const form = new FormData();
  form.set("madeOn", "2026-03-01");
  for (let i = 0; i < 2; i++) form.append("photos", new File([new Uint8Array(await phonePhoto(800, 600))], `cook-${i}.jpg`, { type: "image/jpeg" }));

  const response = await app.request(`/api/recipes/${recipeId}/cooks`, { method: "POST", headers, body: form });
  expect(response.status).toBe(201);

  const plain = new FormData();
  plain.set("madeOn", "2026-03-08");
  expect((await app.request(`/api/recipes/${recipeId}/cooks`, { method: "POST", headers, body: plain })).status).toBe(201);

  const now = await recipe();
  expect(now.lastMadeOn).toBe("2026-03-08");
  expect(now.cooks.map((cook) => [cook.madeOn, cook.by, cook.photos.length])).toEqual([
    ["2026-03-08", "peyton", 0],
    ["2026-03-01", "peyton", 2],
  ]);
  expect(now.photos.filter((photo) => photo.role === "gallery")).toHaveLength(2);
  expect(now.cooks[1]!.photos.every((photo) => existsSync(fileOf(photo.id)))).toBe(true);

  const bad = new FormData();
  bad.set("madeOn", "last week");
  expect((await app.request(`/api/recipes/${recipeId}/cooks`, { method: "POST", headers, body: bad })).status).toBe(400);
});
