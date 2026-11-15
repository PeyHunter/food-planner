import sharp from "sharp";
import { expect, test } from "vitest";
import type { Photo, ShareLink, SharedRecipe } from "../src/shared/recipes.ts";
import { createTestApp, startingUsers } from "./support/test-app.ts";

const smallPhoto = () => sharp({ create: { width: 80, height: 60, channels: 3, background: "#e8a33c" } }).jpeg().toBuffer();

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
  const upload = async (recipeId: string, role: "main" | "gallery") => {
    const form = new FormData();
    form.set("photo", new File([new Uint8Array(await smallPhoto())], "pie.jpg", { type: "image/jpeg" }));
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
  const { app, addRecipe, share, pathOf } = await setUp();
  const recipeId = await addRecipe("Fish pie");

  expect(await share(recipeId, "GET")).toBeNull();
  const url = (await share(recipeId, "POST"))!;
  expect(url).toMatch(/^https:\/\/food\.example\/s\/[A-Za-z0-9_-]{43}$/);
  expect(await share(recipeId, "POST")).toBe(url);
  expect(await share(recipeId, "GET")).toBe(url);
  const token = pathOf(url).split("/")[2]!;

  const response = await app.request(`/api/share/${token}`);
  expect(response.status).toBe(200);
  const shared = (await response.json()) as SharedRecipe;
  expect(shared).toEqual({
    title: "Fish pie",
    feeds: 4,
    types: ["Fish"],
    tags: ["kid-friendly"],
    mainPhoto: null,
    photos: [],
    lines: [{ amount: 400, unit: "g", note: "skin off", ingredient: expect.objectContaining({ name: "Cod" }) }],
    steps: ["Bake it."],
  });

  expect(await share(recipeId, "DELETE")).toBeNull();
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
  expect(html).toContain(`<link rel="preload" as="image" href="${shared.mainPhoto!.url}" fetchpriority="high" />`);
  expect(html).toContain("<title>Fish &lt;/script&gt; pie · Food planner</title>");
  const data = /<script id="share-data" type="application\/json">(.*?)<\/script>/.exec(html)?.[1];
  expect(JSON.parse(data!)).toEqual(shared);

  await share(recipeId, "DELETE");
  expect((await app.request(shared.mainPhoto!.url)).status).toBe(404);
  expect((await app.request(shared.photos[1]!.url)).status).toBe(404);
  const gone = await app.request(`/s/${token}`);
  expect(gone.status).toBe(404);
  expect(gone.headers.get("cache-control")).toBe("no-store");
  const goneHtml = await gone.text();
  expect(goneHtml).toContain('<script id="share-data" type="application/json">null</script>');
  expect(goneHtml).not.toContain("Fish");
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
