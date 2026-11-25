import Anthropic from "@anthropic-ai/sdk";
import { Hono, type Context } from "hono";
import type { Idea } from "../shared/can-make.ts";
import type { Language } from "../shared/profile.ts";
import type { AppDependencies } from "./app.ts";
import { loggingClient } from "./ai-calls.ts";
import { model, type PhotoRecipeClient } from "./photo-recipe.ts";
import { kitchenMember, type MemberEnv } from "./recipes.ts";

type CreateParams = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;
type Message = Anthropic.Beta.Messages.BetaMessage;
type Turn = Anthropic.Beta.Messages.BetaMessageParam;

// Searching a few sites and reading their results takes a while; the phone shows a friendly wait meanwhile.
const timeoutMs = 90_000;
// The server tool may pause a long turn; this many times we send it back to carry on.
const maxPauses = 3;
const maxIdeas = 6;
const maxHave = 30;
const toolName = "suggest_dishes";

/** Only these sites can be suggested. A search may still wander elsewhere; those results are dropped below. */
export const searchDomains = ["valdemarsro.dk", "arla.dk", "dk-kogebogen.dk", "madensverden.dk", "bbcgoodfood.com", "seriouseats.com"];

export const notSetUp = "Finding recipes online isn't set up yet.";
const noIdeas = "We couldn't find recipes for those ingredients. Try different ones.";
const tooSlow = "Searching took too long. Try again, or with fewer ingredients.";
const busy = "The recipe search is busy right now. Try again in a minute.";
const badKey = "Finding recipes online isn't set up right. The API key may be wrong.";

const search: Anthropic.Beta.Messages.BetaWebSearchTool20260209 = {
  type: "web_search_20260209",
  name: "web_search",
  max_uses: 4,
  allowed_domains: searchDomains,
};

const tool: Anthropic.Beta.Messages.BetaTool = {
  name: toolName,
  description: "Save the recipes found on the web.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["ideas"],
    properties: {
      ideas: {
        type: "array",
        description: "Up to 6 recipes, best match first.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "url", "site", "why", "missing"],
          properties: {
            title: { type: "string", description: "The recipe's name, as the page has it." },
            url: { type: "string", description: "The full https address of the recipe page, exactly as it appeared in the search results." },
            site: { type: "string", description: "The site's name, e.g. Valdemarsro." },
            why: { type: "string", description: "One short, plain sentence: what it uses from the cook's list." },
            missing: { type: "array", items: { type: "string" }, description: "The main ingredients the recipe needs that are not on the list. Empty if none." },
          },
        },
      },
    },
  },
};

const system = (language: Language) => `You find real dinner recipes on the web for a home cook.
Search with the web_search tool, up to 4 searches. Prefer valdemarsro.dk, a Danish cooking site. Look for recipes that use mostly the ingredients the cook has.
Only suggest a recipe whose page address you saw in the search results. Never invent an address.
- ${language === "da" ? "Write title, why and missing in Danish." : "Write title, why and missing in English. Danish sites are still fine."}
- why is one short, plain sentence about what the recipe uses from the cook's list.
- missing lists the main ingredients the recipe needs that the cook doesn't have. Leave it empty if there are none.
When you have up to 6 recipes, answer by calling ${toolName} once with them.`;

class Refused extends Error {}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const list = (value: unknown) => (Array.isArray(value) ? value : []);

/** The 1 to 30 ingredient names sent to "What can I make?", trimmed. */
export function parseHave(body: unknown): string[] | { error: string } {
  const rawHave = body && typeof body === "object" ? (body as Record<string, unknown>).have : undefined;
  if (!Array.isArray(rawHave) || rawHave.length < 1 || rawHave.length > maxHave) return { error: `List 1 to ${maxHave} ingredients you have.` };
  const have = rawHave.map(text);
  if (have.some((name) => !name)) return { error: "Every ingredient needs a name." };
  if (have.some((name) => name.length > 80)) return { error: "Keep each ingredient name short." };
  return have;
}

/** The address as a URL when it is https on one of the search sites (or a subdomain of one), else undefined. */
function allowedUrl(value: unknown): URL | undefined {
  if (typeof value !== "string") return undefined;
  const url = URL.parse(value.trim());
  if (!url || url.protocol !== "https:" || url.username || url.password) return undefined;
  const allowed = searchDomains.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
  return allowed ? url : undefined;
}

/** What the model's suggest_dishes call holds, checked before it reaches the phone: bad or foreign addresses, duplicates and extras are dropped. */
export function toIdeas(output: unknown): Idea[] {
  const raw = output && typeof output === "object" ? (output as Record<string, unknown>).ideas : undefined;
  const seen = new Set<string>();
  const ideas: Idea[] = [];
  for (const value of list(raw)) {
    if (ideas.length >= maxIdeas) break;
    const item = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
    const url = allowedUrl(item.url);
    const title = text(item.title).slice(0, 200);
    if (!url || !title || seen.has(url.href)) continue;
    seen.add(url.href);
    ideas.push({
      title,
      url: url.href,
      site: text(item.site).slice(0, 80) || url.hostname.replace(/^www\./, ""),
      why: text(item.why).slice(0, 300),
      missing: list(item.missing).map(text).filter(Boolean).slice(0, 10).map((name) => name.slice(0, 80)),
    });
  }
  return ideas;
}

/** Asks the model to search and suggest; pauses are continued, and a refusal throws. Search errors come back as content blocks and are only logged. */
export async function findIdeas(client: PhotoRecipeClient, have: string[], language: Language, signal: AbortSignal): Promise<Idea[]> {
  const messages: Turn[] = [{ role: "user", content: `The cook has: ${have.join(", ")}.\nFind the recipes.` }];
  for (let pauses = 0; ; pauses++) {
    const message: Message = await client.beta.messages.create(
      {
        model,
        max_tokens: 8000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low" },
        system: system(language),
        tools: [search, tool],
        // Forced tool_choice is refused by this model, so the prompt asks for the tool.
        tool_choice: { type: "auto" },
        messages,
      },
      { signal, maxRetries: 1 },
    );
    for (const block of message.content) {
      if (block.type === "web_search_tool_result" && !Array.isArray(block.content)) console.error(`recipe ideas: web search error ${block.content.error_code}`);
    }
    if (message.stop_reason === "refusal") throw new Refused();
    if (message.stop_reason === "pause_turn" && pauses < maxPauses) {
      messages.push({ role: "assistant", content: message.content as Anthropic.Beta.Messages.BetaContentBlockParam[] });
      continue;
    }
    const call = message.content.find((block) => block.type === "tool_use" && block.name === toolName);
    return call && "input" in call ? toIdeas(call.input) : [];
  }
}

/** Stands in for the search when PHOTO_RECIPE_FAKE is set (browser tests): the suggest_dishes call always holds `ideas`. */
export function fakeIdeasClient(ideas: unknown, calls: CreateParams[] = []): PhotoRecipeClient {
  return {
    beta: {
      messages: {
        async create(params) {
          calls.push(params);
          return {
            id: "msg_fake",
            type: "message",
            role: "assistant",
            model,
            stop_reason: "tool_use",
            usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
            content: [{ type: "tool_use", id: "toolu_fake", name: toolName, input: { ideas } }],
          } as unknown as Message;
        },
      },
    },
  };
}

function failure(c: Context, error: unknown, signal: AbortSignal) {
  if (error instanceof Refused) return c.json({ error: noIdeas }, 422);
  if (signal.aborted) return c.json({ error: tooSlow }, 504);
  // Status and type only: never the key or the request.
  const status = error instanceof Anthropic.APIError ? error.status : undefined;
  console.error(`recipe ideas failed: ${status ?? (error as Error).name}`);
  if (status === 401 || status === 403) return c.json({ error: badKey }, 503);
  return c.json({ error: busy }, 503);
}

export function createIdeasRoutes({ database, now, photoRecipeClient }: AppDependencies) {
  const routes = new Hono<MemberEnv>();
  const member = kitchenMember({ database, now });

  routes.post("/api/recipes/ideas-from-web", member, async (c) => {
    if (!photoRecipeClient) return c.json({ error: notSetUp }, 503);
    const have = parseHave(await c.req.json().catch(() => undefined));
    if ("error" in have) return c.json(have, 400);
    const { kitchenId, userId, language } = c.get("member");
    const signal = AbortSignal.timeout(timeoutMs);
    try {
      const client = loggingClient(photoRecipeClient, database, { kitchenId, userId, feature: "ideas" });
      return c.json({ ideas: await findIdeas(client, have, language, signal) });
    } catch (error) {
      return failure(c, error, signal);
    }
  });

  return routes;
}
