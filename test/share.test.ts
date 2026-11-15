import { existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { expect, inject, test } from "vitest";
import { sharePhotoFile } from "../src/server/photos.ts";
import type { Photo, Recipe, ShareLink, SharedRecipe } from "../src/shared/recipes.ts";
import { createTestApp, startingUsers } from "./support/test-app.ts";

const smallPhoto = (width = 80, height = 60) => sharp({ create: { width, height, channels: 3, background: "#e8a33c" } }).jpeg().toBuffer();

async function setUp() {
  const app = await createTestApp({ publicUrl: "https://food.example" });
  const { cookie } = await app.logIn("peyton", startingUsers[0]!.password);
  const headers = { cookie: cookie! };
  const addRecipe = async (title: string) => {
    const response = await app.request("/api/recipes", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ title, feeds: 4, types: ["Fish"], tags: ["kid-friendly"], lines: [{ amount: 400, unit: "g", ingredient: "Cod", note: "skin off" }], steps: ["Bake it."] }),
    });
    return ((await response.json()) as { id: string }).id;
  };
  const upload = async (recipeId: string, role: "main" | "gallery", width?: number, height?: number) => {
    const form = new FormData();
    form.set("photo", new File([new Uint8Array(await smallPhoto(width, height))], "pie.jpg", { type: "image/jpeg" }));
    form.set("role", role);
    return (await (await app.request(`/api/recipes/${recipeId}/photos`, { method: "POST", headers, body: form })).json()) as Photo;
  };
  const share = async (recipeId: string, method: "GET" | "POST" | "DELETE") => {
    const response = await app.request(`/api/recipes/${recipeId}/share`, { method, headers });
    expect(response.status).toBe(200);
    return ((await response.json()) as ShareLink).url;
  };
  const pathOf = (url: string) => new URL(url).pathname;
  return { app, headers, addRecipe, upload, share, pathOf };
}

test("a share link turns on, shows the recipe without a login, and turns off for good", async () => {
  const { app, headers, addRecipe, share, pathOf } = await setUp();
  const recipeId = await addRecipe("Fish pie");

  expect(await share(recipeId, "GET")).toBeNull();
  const url = (await share(recipeId, "POST"))!;
  expect(url).toMatch(/^https:\/\/food\.example\/s\/[A-Za-z0-9_-]{43}$/);
  expect(await share(recipeId, "POST")).toBe(url);
  expect(await share(recipeId, "GET")).toBe(url);
  const recipe = async () => (await (await app.request(`/api/recipes/${recipeId}`, { headers })).json()) as Recipe;
  // The recipe carries its link, so the Share panel needs no second call.
  expect((await recipe()).shareUrl).toBe(url);
  const token = pathOf(url).split("/")[2]!;

  const response = await app.request(`/api/share/${token}`);
  expect(response.status).toBe(200);
  const shared = (await response.json()) as SharedRecipe;
  expect(shared).toEqual({
    title: "Fish pie",
    description: "",
    feeds: 4,
    minutes: null,
    types: ["Fish"],
    tags: ["kid-friendly"],
    mainPhoto: null,
    photos: [],
    lines: [{ amount: 400, unit: "g", note: "skin off", ingredient: expect.objectContaining({ name: "Cod" }) }],
    steps: ["Bake it."],
  });

  expect(await share(recipeId, "DELETE")).toBeNull();
  expect((await recipe()).shareUrl).toBeNull();
  expect((await app.request(`/api/share/${token}`)).status).toBe(404);
  expect((await app.request(pathOf(url))).status).toBe(404);

  const again = (await share(recipeId, "POST"))!;
  expect(again).not.toBe(url);
  expect((await app.request(`/api/share/${token}`)).status).toBe(404);
});

test("unknown or made-up tokens get a 404", async () => {
  const { app } = await setUp();
  for (const token of ["nope", "A".repeat(43), "a%2Fb"]) {
    expect((await app.request(`/api/share/${token}`)).status).toBe(404);
    expect((await app.request(`/s/${token}`)).status).toBe(404);
  }
});

test("photos of a shared recipe open through the link only, and only while it is on; the page carries the recipe and is never cached", async () => {
  const { app, headers, addRecipe, upload, share, pathOf } = await setUp();
  const recipeId = await addRecipe("Fish </script> pie");
  const main = await upload(recipeId, "main");
  const extra = await upload(recipeId, "gallery");
  const token = pathOf((await share(recipeId, "POST"))!).split("/")[2]!;

  const shared = (await (await app.request(`/api/share/${token}`)).json()) as SharedRecipe;
  expect(shared.mainPhoto?.url).toBe(`/s/${token}/photos/${main.id}.jpg`);
  expect(shared.photos.map((photo) => photo.url)).toEqual([`/s/${token}/photos/${main.id}.jpg`, `/s/${token}/photos/${extra.id}.jpg`]);

  const served = await app.request(shared.mainPhoto!.url);
  expect(served.status).toBe(200);
  expect(served.headers.get("content-type")).toBe("image/jpeg");
  // The private photo API still needs a login.
  expect((await app.request(main.url)).status).toBe(401);
  expect((await app.request(main.url, { headers })).status).toBe(200);

  // The page itself carries the recipe and a preload for its main photo, and must never be cached.
  const page = await app.request(`/s/${token}`);
  expect(page.status).toBe(200);
  expect(page.headers.get("content-type")).toContain("text/html");
  expect(page.headers.get("cache-control")).toBe("no-store");
  const html = await page.text();
  expect(html).toContain(
    `<link rel="preload" as="image" href="${shared.mainPhoto!.smallUrl}" media="(max-width: 35.98rem)" fetchpriority="high" />` +
      `<link rel="preload" as="image" href="${shared.mainPhoto!.url}" media="(min-width: 36rem)" fetchpriority="high" />`,
  );
  expect(html).toContain("<title>Fish &lt;/script&gt; pie · Food planner</title>");
  const data = /<script id="share-data" type="application\/json">(.*?)<\/script>/.exec(html)?.[1];
  expect(JSON.parse(data!)).toEqual(shared);

  await share(recipeId, "DELETE");
  expect((await app.request(shared.mainPhoto!.url)).status).toBe(404);
  expect((await app.request(shared.mainPhoto!.smallUrl)).status).toBe(404);
  expect((await app.request(shared.photos[1]!.url)).status).toBe(404);
  const gone = await app.request(`/s/${token}`);
  expect(gone.status).toBe(404);
  expect(gone.headers.get("cache-control")).toBe("no-store");
  const goneHtml = await gone.text();
  expect(goneHtml).toContain('<script id="share-data" type="application/json">null</script>');
  expect(goneHtml).not.toContain("Fish");
});

test("the share page's main photo has an 800 px copy, made once, kept next to the photo, and removed with it", async () => {
  const { app, headers, addRecipe, upload, share, pathOf } = await setUp();
  const recipeId = await addRecipe("Fish pie");
  const main = await upload(recipeId, "main", 1600, 1200);
  const token = pathOf((await share(recipeId, "POST"))!).split("/")[2]!;
  const shared = (await (await app.request(`/api/share/${token}`)).json()) as SharedRecipe;
  expect(shared.mainPhoto?.smallUrl).toBe(`/s/${token}/photos/${main.id}-800.jpg`);
  const copy = join(inject("scratchDir"), `${main.id}-800.jpg`);
  expect(existsSync(copy)).toBe(false);

  const [first, second] = await Promise.all([app.request(shared.mainPhoto!.smallUrl), app.request(shared.mainPhoto!.smallUrl)]);
  for (const response of [first!, second!]) {
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cache-control")).toBe("private, max-age=31536000, immutable");
  }
  const small = Buffer.from(await first!.arrayBuffer());
  expect(await sharp(small).metadata()).toMatchObject({ width: 800, height: 600 });
  const full = Buffer.from(await (await app.request(shared.mainPhoto!.url)).arrayBuffer());
  expect(small.length).toBeLessThan(full.length);
  expect(existsSync(copy)).toBe(true);
  expect(Buffer.from(await (await app.request(shared.mainPhoto!.smallUrl)).arrayBuffer())).toEqual(small);

  // Only the 800 px size exists.
  expect((await app.request(`/s/${token}/photos/${main.id}-400.jpg`)).status).toBe(404);

  await app.request(`/api/photos/${main.id}`, { method: "DELETE", headers });
  expect(existsSync(copy)).toBe(false);
});

test("a share photo's file name gives its id, and whether the small copy is wanted", () => {
  const id = "3f2a1b2c-1111-4222-8333-123456789012";
  expect(sharePhotoFile(`${id}.jpg`)).toEqual({ id, small: false });
  expect(sharePhotoFile(id)).toEqual({ id, small: false });
  expect(sharePhotoFile(`${id}-800.jpg`)).toEqual({ id, small: true });
  expect(sharePhotoFile(`${id}-400.jpg`)).toBeUndefined();
  expect(sharePhotoFile("..%2F..%2Fetc%2Fpasswd")).toBeUndefined();
});

test("a share link never leaks another recipe or its photos", async () => {
  const { app, addRecipe, upload, share, pathOf } = await setUp();
  const sharedId = await addRecipe("Fish pie");
  const privateId = await addRecipe("Secret stew");
  const secret = await upload(privateId, "main");
  const token = pathOf((await share(sharedId, "POST"))!).split("/")[2]!;

  const body = await (await app.request(`/api/share/${token}`)).text();
  expect(body).not.toContain("Secret stew");
  expect(body).not.toContain(privateId);
  expect(body).not.toContain(sharedId);
  expect(body).not.toContain("peyton");

  expect((await app.request(`/s/${token}/photos/${secret.id}.jpg`)).status).toBe(404);
  expect((await app.request(`/s/${token}/photos/..%2F..%2Fetc%2Fpasswd`)).status).toBe(404);
  expect((await app.request(`/api/recipes/${privateId}`)).status).toBe(401);
  expect((await app.request(`/api/recipes/${privateId}/share`, { method: "POST" })).status).toBe(401);
});

test("only the recipe's own kitchen can turn its link on or off", async () => {
  const { app, headers, addRecipe } = await setUp();
  const recipeId = await addRecipe("Fish pie");
  const [other] = await app.query<{ id: string }>("insert into kitchens (name) values ('Next door') returning id");
  await app.query("update recipes set kitchen_id = $1 where id = $2", [other!.id, recipeId]);
  for (const method of ["GET", "POST", "DELETE"]) {
    expect((await app.request(`/api/recipes/${recipeId}/share`, { method, headers })).status).toBe(404);
  }
});
