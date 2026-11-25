import type Anthropic from "@anthropic-ai/sdk";
import { expect, test } from "vitest";
import { model, type PhotoRecipeClient } from "../src/server/photo-recipe.ts";
import { toIdeas } from "../src/server/web-ideas.ts";
import type { Idea } from "../src/shared/can-make.ts";
import { createTestApp, startingUsers } from "./support/test-app.ts";

type CreateParams = Parameters<PhotoRecipeClient["beta"]["messages"]["create"]>[0];
type Reply = Anthropic.Beta.Messages.BetaMessage;

const reply = (content: unknown[], stop_reason: string) =>
  ({ id: "msg_test", type: "message", role: "assistant", model, stop_reason, usage: { input_tokens: 10, output_tokens: 5 }, content }) as unknown as Reply;

const suggestion = (ideas: unknown) => reply([{ type: "tool_use", id: "toolu_1", name: "suggest_dishes", input: { ideas } }], "tool_use");

const pause = () => reply([{ type: "text", text: "Searching…" }], "pause_turn");

/** Answers each call with the next scripted reply, and keeps a copy of what was sent. */
function scripted(replies: Reply[], calls: CreateParams[] = []): PhotoRecipeClient {
  return {
    beta: {
      messages: {
        async create(params) {
          calls.push(structuredClone(params));
          const next = replies.shift();
          if (!next) throw new Error("No reply left in the script.");
          return next;
        },
      },
    },
  };
}

const idea = (title: string, url: string, extra: Record<string, unknown> = {}) => ({ title, url, site: "Valdemarsro", why: "Uses the potatoes.", missing: ["Eggs"], ...extra });

async function setUp(photoRecipeClient?: PhotoRecipeClient) {
  const app = await createTestApp({ photoRecipeClient });
  const { cookie } = await app.logIn("peyton", startingUsers[0]!.password);
  const find = (body: unknown) => app.request("/api/recipes/ideas-from-web", { method: "POST", headers: { cookie: cookie!, "content-type": "application/json" }, body: JSON.stringify(body) });
  return { app, find };
}

test("the request searches the web on the allowed sites and asks for the suggest_dishes tool, with the cook's ingredients", async () => {
  const calls: CreateParams[] = [];
  const { find } = await setUp(scripted([suggestion([idea("Kartoffelpandekager", "https://valdemarsro.dk/kartoffelpandekager/")])], calls));

  const response = await find({ have: ["potatoes", " onions "] });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ideas: [expect.objectContaining({ title: "Kartoffelpandekager" })] });

  const [sent] = calls;
  expect(sent).toMatchObject({ model, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default", output_config: { effort: "low" }, max_tokens: 8000, tool_choice: { type: "auto" } });
  const search = sent!.tools!.find((tool) => "name" in tool && tool.name === "web_search") as unknown as { type: string; max_uses: number; allowed_domains: string[] };
  expect(search).toMatchObject({ type: "web_search_20260209", max_uses: 4 });
  expect(search.allowed_domains).toEqual(["valdemarsro.dk", "arla.dk", "dk-kogebogen.dk", "madensverden.dk", "bbcgoodfood.com", "seriouseats.com"]);
  const suggest = sent!.tools!.find((tool) => "name" in tool && tool.name === "suggest_dishes") as unknown as { strict: boolean; input_schema: { additionalProperties: boolean } };
  expect(suggest.strict).toBe(true);
  expect(suggest.input_schema.additionalProperties).toBe(false);
  expect(JSON.stringify(sent!.messages)).toContain("The cook has: potatoes, onions.");
  expect(sent!.system).toContain("valdemarsro.dk");
});

test("a paused search is sent back with what the model had so far, and carries on", async () => {
  const calls: CreateParams[] = [];
  const { find } = await setUp(scripted([pause(), pause(), suggestion([idea("Gryderet", "https://www.arla.dk/gryderet")])], calls));

  const response = await find({ have: ["beef"] });
  expect(response.status).toBe(200);
  expect(((await response.json()) as { ideas: Idea[] }).ideas.map((item) => item.url)).toEqual(["https://www.arla.dk/gryderet"]);
  expect(calls).toHaveLength(3);
  const second = calls[1]!.messages;
  expect(second.at(-1)).toEqual({ role: "assistant", content: [{ type: "text", text: "Searching…" }] });
});

test("after three pauses the answer is taken as it is, so an endless search cannot hang the request", async () => {
  const calls: CreateParams[] = [];
  const { find } = await setUp(scripted([pause(), pause(), pause(), pause()], calls));

  const response = await find({ have: ["beef"] });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ideas: [] });
  expect(calls).toHaveLength(4);
});

test("addresses that are not https, not on an allowed site, or look like one, are dropped; duplicates and extras too", () => {
  const ideas = toIdeas({
    ideas: [
      idea("Good", "https://valdemarsro.dk/good/"),
      idea("Same again", "https://valdemarsro.dk/good/"),
      idea("Plain http", "http://valdemarsro.dk/http/"),
      idea("Lookalike", "https://valdemarsro.dk.example.com/fake/"),
      idea("Other site", "https://example.com/recipe/"),
      idea("Prefix trick", "https://notvaldemarsro.dk/recipe/"),
      idea("Subdomain", "https://www.seriouseats.com/sub"),
      idea("With login", "https://user:pw@arla.dk/x"),
      idea("", "https://arla.dk/no-title/"),
      { title: "Not text", url: 42, site: "x", why: "x", missing: [] },
      "nonsense",
      idea("Two", "https://arla.dk/two/"),
      idea("Three", "https://arla.dk/three/"),
      idea("Four", "https://arla.dk/four/"),
      idea("Five", "https://arla.dk/five/"),
      idea("Six", "https://arla.dk/six/"),
      idea("Seven", "https://arla.dk/seven/"),
    ],
  });
  expect(ideas.map((item) => item.title)).toEqual(["Good", "Subdomain", "Two", "Three", "Four", "Five"]);
  expect(ideas[1]).toMatchObject({ url: "https://www.seriouseats.com/sub", site: "Valdemarsro" });
});

test("a site name and missing list from the model are trimmed and capped, and the site falls back to the host", () => {
  const [item] = toIdeas({
    ideas: [{ title: "  Bolledej  ", url: "https://www.madensverden.dk/bolledej", site: "  ", why: "x".repeat(400), missing: [" Flour ", "", 5, "Butter"] }],
  });
  expect(item).toEqual({ title: "Bolledej", url: "https://www.madensverden.dk/bolledej", site: "madensverden.dk", why: "x".repeat(300), missing: ["Flour", "Butter"] });
  expect(toIdeas(undefined)).toEqual([]);
});

test("the answer's ideas that are foreign are dropped on the way out, not just in the unit", async () => {
  const { find } = await setUp(scripted([suggestion([idea("Foreign", "https://example.com/x"), idea("Kept", "https://valdemarsro.dk/kept/")])]));
  const response = await find({ have: ["rice"] });
  expect(((await response.json()) as { ideas: Idea[] }).ideas.map((item) => item.title)).toEqual(["Kept"]);
});

test("a model that finds nothing answers with an empty list", async () => {
  const { find } = await setUp(scripted([suggestion([])]));
  expect(await (await find({ have: ["rice"] })).json()).toEqual({ ideas: [] });
});

test("a refusal is a plain error, not a crash", async () => {
  const { find } = await setUp(scripted([reply([], "refusal")]));
  const response = await find({ have: ["rice"] });
  expect(response.status).toBe(422);
  expect(await response.json()).toEqual({ error: "We couldn't find recipes for those ingredients. Try different ones." });
});

test("a search error comes back as a content block: the answer is still used", async () => {
  const errored = reply(
    [
      { type: "web_search_tool_result", tool_use_id: "srvtoolu_1", content: { type: "web_search_tool_result_error", error_code: "too_many_requests" } },
      { type: "tool_use", id: "toolu_1", name: "suggest_dishes", input: { ideas: [idea("Kept", "https://arla.dk/kept/")] } },
    ],
    "tool_use",
  );
  const { find } = await setUp(scripted([errored]));
  const response = await find({ have: ["rice"] });
  expect(((await response.json()) as { ideas: Idea[] }).ideas.map((item) => item.title)).toEqual(["Kept"]);
});

test("without an API key the feature says it is not set up", async () => {
  const { find } = await setUp();
  const response = await find({ have: ["rice"] });
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "Finding recipes online isn't set up yet." });
});

test("the have list is checked before anything is sent", async () => {
  const calls: CreateParams[] = [];
  const { find } = await setUp(scripted([], calls));
  expect((await find({ have: [] })).status).toBe(400);
  expect((await find({ have: ["x".repeat(81)] })).status).toBe(400);
  expect((await find({ have: Array.from({ length: 31 }, (_, index) => `item ${index}`) })).status).toBe(400);
  expect(calls).toHaveLength(0);
});
