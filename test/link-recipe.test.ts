import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import sharp from "sharp";
import { expect, test } from "vitest";
import { fetchPublic, findImageUrl, findRecipeData, isPrivateAddress, LinkProblem, pageText, parseLink, type OpenUrl } from "../src/server/link-recipe.ts";
import { fakeClient, type PhotoRecipeClient } from "../src/server/photo-recipe.ts";
import type { PhotoRecipeDraft } from "../src/shared/recipes.ts";
import { createTestApp, startingUsers } from "./support/test-app.ts";

const recipePage = (image = "https://img.example.com/salmon.jpg") => `<!doctype html><html><head><title>Salmon bake</title>
<meta property="og:image" content="https://img.example.com/og.jpg">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage","name":"x"},
{"@type":["Recipe"],"name":"Salmon bake","recipeYield":"4 servings","totalTime":"PT40M","image":{"@type":"ImageObject","url":"${image}"},
"recipeIngredient":["2 cups rice","1 lb salmon, skin off"],"recipeInstructions":[{"@type":"HowToStep","text":"Bake 20 min."}],
"aggregateRating":{"ratingValue":"4.8"},"review":[{"reviewBody":"long review text"}]}]}</script></head><body>Hi</body></html>`;

test("only public web addresses are opened", () => {
  for (const ok of ["https://www.bbcgoodfood.com/recipes/x", "http://valdemarsro.dk/laks/"]) expect(parseLink(ok)?.href).toBe(ok);
  for (const bad of ["ftp://x.com/a", "javascript:alert(1)", "https://user:pw@x.com/", "http://localhost:3000/", "http://127.0.0.1/", "http://10.0.0.5/", "http://192.168.1.1/admin", "http://[::1]/", "http://169.254.169.254/latest/meta-data", "http://[::ffff:127.0.0.1]/", "http://[::ffff:a00:1]/", "http://2130706433/", "http://0x7f.1/", "http://[::127.0.0.1]/", "http://postgres:5432/", "http://web.food-planner.svc.cluster.local/", "not a link", 42]) {
    expect(parseLink(bad)).toBeUndefined();
  }
  for (const address of ["10.1.2.3", "172.20.0.1", "192.168.0.10", "127.0.0.1", "169.254.169.254", "100.64.1.1", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1", "::ffff:7f00:1", "::7f00:1"]) expect(isPrivateAddress(address)).toBe(true);
  for (const address of ["8.8.8.8", "151.101.1.69", "2606:4700::1111"]) expect(isPrivateAddress(address)).toBe(false);
});

test("a name that points at this machine is refused when connecting, before any bytes are sent", async () => {
  let asked = 0;
  const server = createServer((_, response) => {
    asked++;
    response.end("secret");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    await expect(fetchPublic(new URL(`http://localhost:${port}/`), "*/*", 1000, AbortSignal.timeout(5000))).rejects.toThrow("That address isn't a public website.");
    expect(asked).toBe(0);
  } finally {
    server.close();
  }
});

test("the recipe data is found inside @graph, and the dish picture comes from it before og:image", () => {
  const html = recipePage();
  const data = findRecipeData(html)!;
  expect(data.name).toBe("Salmon bake");
  expect(findImageUrl(html, data, new URL("https://food.example/r/1"))?.href).toBe("https://img.example.com/salmon.jpg");
  expect(findImageUrl(html.replace(/"image":\{[^}]*\},/, ""), findRecipeData(html.replace(/"image":\{[^}]*\},/, "")), new URL("https://food.example/"))?.href).toBe("https://img.example.com/og.jpg");
  expect(findImageUrl('<meta property="og:image" content="/img/a.jpg">', undefined, new URL("https://food.example/r/1"))?.href).toBe("https://food.example/img/a.jpg");
  expect(findImageUrl('<meta property="og:image" content="http://10.0.0.1/a.jpg">', undefined, new URL("https://food.example/"))).toBeUndefined();
  expect(findRecipeData("<script type='application/ld+json'>{broken</script>")).toBeUndefined();
});

test("a page without recipe data becomes plain text without scripts or tags", () => {
  const text = pageText("<html><head><title>Mormors boller</title><style>p{}</style></head><body><script>track()</script><h1>Boller</h1><ul><li>500 g mel</li><li>2 æg</li></ul><p>Bag dem &amp; spis.</p></body></html>");
  expect(text).toContain("Mormors boller");
  expect(text).toContain("- 500 g mel");
  expect(text).toContain("Bag dem & spis.");
  expect(text).not.toContain("track()");
  expect(text).not.toContain("<");
});

async function setUp(pages: Record<string, { type: string; body: string | Buffer } | number>, output: unknown) {
  const calls: Parameters<PhotoRecipeClient["beta"]["messages"]["create"]>[0][] = [];
  const opened: string[] = [];
  const openUrl: OpenUrl = async (url) => {
    opened.push(url.href);
    const page = pages[url.href];
    if (page === undefined || typeof page === "number") throw new LinkProblem(page === 403 ? "That site doesn't let apps read its recipes. Take a screenshot and use Photo to recipe instead." : "That page doesn't exist. Check the link.");
    return { url, type: page.type, body: Buffer.from(page.body) };
  };
  const app = await createTestApp({ photoRecipeClient: fakeClient(output, calls), openUrl });
  const { cookie } = await app.logIn("peyton", startingUsers[0]!.password);
  const read = (url: unknown) => app.request("/api/recipes/from-link", { method: "POST", headers: { cookie: cookie!, "content-type": "application/json" }, body: JSON.stringify({ url }) });
  return { read, calls, opened };
}

const salmon = {
  title: "Salmon bake",
  description: "Weeknight salmon.",
  feeds: 4,
  minutes: 40,
  mainTypes: ["Fish"],
  tags: [],
  lines: [{ amount: 4.8, unit: "dl", ingredient: "Rice", note: "" }],
  steps: ["Bake 20 min."],
  dishPhoto: null,
};

test("a recipe link becomes a draft with the dish picture and the link in the description; the model gets the recipe data, not the reviews", async () => {
  const jpeg = await sharp({ create: { width: 2400, height: 1600, channels: 3, background: "#e8a33c" } }).jpeg().toBuffer();
  const { read, calls, opened } = await setUp({ "https://food.example/salmon": { type: "text/html; charset=utf-8", body: recipePage() }, "https://img.example.com/salmon.jpg": { type: "image/jpeg", body: jpeg } }, salmon);

  const response = await read("  https://food.example/salmon ");
  expect(response.status).toBe(200);
  const draft = (await response.json()) as PhotoRecipeDraft;
  expect(draft.recipe.title).toBe("Salmon bake");
  expect(draft.recipe.lines).toEqual([{ amount: 4.8, unit: "dl", ingredient: "Rice", note: "" }]);
  expect(draft.recipe.description).toBe("Weeknight salmon.\n\nFrom https://food.example/salmon");
  expect(draft.dishPhoto).toMatch(/^data:image\/jpeg;base64,/);
  const { width } = await sharp(Buffer.from(draft.dishPhoto!.split(",")[1]!, "base64")).metadata();
  expect(width).toBe(1600);
  expect(opened).toEqual(["https://food.example/salmon", "https://img.example.com/salmon.jpg"]);

  const sent = JSON.stringify(calls[0]!.messages);
  expect(sent).toContain("1 lb salmon, skin off");
  expect(sent).not.toContain("long review text");
  expect(calls[0]!.system).toContain("web page");
});

test("no picture is fine, and blocked or empty pages say what to do instead", async () => {
  const { read } = await setUp(
    {
      "https://food.example/plain": { type: "text/html", body: `<title>Boller</title><p>${"Rør mel, gær og mælk sammen. ".repeat(5)}</p>` },
      "https://nyt.example/recipe": 403,
      "https://food.example/empty": { type: "text/html", body: "<div id=root></div>" },
    },
    salmon,
  );

  const plain = (await (await read("https://food.example/plain")).json()) as PhotoRecipeDraft;
  expect(plain.dishPhoto).toBeNull();
  expect(plain.notes).toContain("We couldn't get a picture of the dish from that page. Add one when you've made it.");

  const blocked = await read("https://nyt.example/recipe");
  expect(blocked.status).toBe(422);
  expect(((await blocked.json()) as { error: string }).error).toMatch(/Photo to recipe/);
  expect((await read("https://food.example/empty")).status).toBe(422);
  expect((await read("http://192.168.1.1/")).status).toBe(400);
  expect((await read("")).status).toBe(400);
});

test("a page the model finds no recipe on is refused", async () => {
  const { read } = await setUp({ "https://food.example/news": { type: "text/html", body: recipePage() } }, { ...salmon, lines: [], steps: [] });
  const response = await read("https://food.example/news");
  expect(response.status).toBe(422);
  expect(((await response.json()) as { error: string }).error).toMatch(/couldn't find a recipe/);
});

test("broken or hostile pages are read quickly and never crash the reader", () => {
  const hostile = "<script ".repeat(200_000) + "<!--".repeat(100_000) + "<meta ".repeat(100_000) + "<b".repeat(100_000);
  const started = performance.now();
  pageText(hostile);
  findRecipeData(hostile);
  findImageUrl(hostile, undefined, new URL("https://food.example/"));
  expect(performance.now() - started).toBeLessThan(1500);

  const text = pageText("<title>Boller &#99999999; &#x110000;</title><p>Rør &#229; godt</p>");
  expect(text.startsWith("Boller &#99999999; &#x110000;\n")).toBe(true);
  expect(text).toContain("Rør å godt");
  expect(text.match(/Boller/g)).toHaveLength(1);
  expect(findImageUrl("<meta content='https://img.example.com/a.jpg?x=1&amp;y=2' property=og:image>", undefined, new URL("https://food.example/"))?.href).toBe("https://img.example.com/a.jpg?x=1&y=2");
  expect(findRecipeData('<script type=application/ld+json>{"@type":"Recipe","name":"Unquoted"}</script>')?.name).toBe("Unquoted");
});
