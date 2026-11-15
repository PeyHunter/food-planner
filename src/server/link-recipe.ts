import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";
import sharp from "sharp";

/** Pages bigger than this are cut off; a recipe page's data is near the top. */
const maxPageBytes = 3 * 1024 * 1024;
const maxImageBytes = 15 * 1024 * 1024;
const maxRedirects = 4;
export const pageTimeoutMs = 15_000;
/** Sent to the model when a page has no recipe data: enough for a long recipe, short enough to be cheap. */
const maxTextChars = 40_000;
const maxSide = 1600;

export class LinkProblem extends Error {}

// Addresses inside the home network, the cluster or this machine. The server never opens these for a pasted link.
const privateNets = new BlockList();
for (const [net, bits] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 3],
] as const)
  privateNets.addSubnet(net, bits, "ipv4");
for (const [net, bits] of [
  ["::", 127],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["64:ff9b::", 96],
  ["2001:db8::", 32],
] as const)
  privateNets.addSubnet(net, bits, "ipv6");

export function isPrivateAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return privateNets.check(address, "ipv4");
  if (family !== 6) return true;
  // ::ffff:10.0.0.1 is an IPv4 address in disguise.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
  return mapped ? privateNets.check(mapped, "ipv4") : privateNets.check(address, "ipv6");
}

/** Looks the name up like normal, but refuses if any address it gets is private. Checked at connect time, so a redirect or a changed DNS answer can't get past it. */
const publicOnlyLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, "", 0);
    const all = addresses as LookupAddress[];
    if (!all.length || all.some((entry) => isPrivateAddress(entry.address))) return callback(new LinkProblem("That address isn't a public website."), "", 0);
    if (options.all) return (callback as unknown as (error: null, addresses: LookupAddress[]) => void)(null, all);
    callback(null, all[0]!.address, all[0]!.family);
  });
};

/** A link someone pasted, checked: http(s) only, no login details, no bare private IPs. */
export function parseLink(value: unknown): URL | undefined {
  if (typeof value !== "string") return undefined;
  const url = URL.parse(value.trim());
  if (!url || (url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) return undefined;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && isPrivateAddress(host)) return undefined;
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || !host.includes(".")) return undefined;
  return url;
}

export type Fetched = { url: URL; type: string; body: Buffer };
/** Opens a public web address; fetchPublic in the app, a stand-in in tests. */
export type OpenUrl = (url: URL, accept: string, maxBytes: number, signal: AbortSignal) => Promise<Fetched>;

/** GET with redirects followed by hand (each hop checked), a time limit and a size limit. */
export async function fetchPublic(start: URL, accept: string, maxBytes: number, signal: AbortSignal): Promise<Fetched> {
  let url = start;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const response = await getOnce(url, accept, maxBytes, signal);
    if ("location" in response) {
      const next = URL.parse(response.location, url);
      const checked = next && parseLink(next.href);
      if (!checked) throw new LinkProblem("That page sends you on to an address we can't open.");
      url = checked;
      continue;
    }
    return { url, ...response };
  }
  throw new LinkProblem("That page sends you on too many times.");
}

function getOnce(url: URL, accept: string, maxBytes: number, signal: AbortSignal): Promise<{ location: string } | { type: string; body: Buffer }> {
  const client = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const request = client.get(
      url,
      {
        lookup: publicOnlyLookup,
        signal,
        headers: {
          accept,
          "accept-language": "en, da;q=0.9, *;q=0.5",
          // Plain bytes, so the size limit counts what we keep.
          "accept-encoding": "identity",
          "user-agent": "food-planner/1.0 (reads one recipe page a person asked for)",
        },
      },
      (response) => {
        const status = response.statusCode ?? 0;
        if (status >= 300 && status < 400 && response.headers.location) {
          response.resume();
          return resolve({ location: response.headers.location });
        }
        if (status === 401 || status === 402 || status === 403) {
          response.resume();
          return reject(new LinkProblem("That site doesn't let apps read its recipes. Take a screenshot and use Photo to recipe instead."));
        }
        if (status < 200 || status >= 300) {
          response.resume();
          return reject(new LinkProblem(status === 404 ? "That page doesn't exist. Check the link." : "That site didn't answer properly. Try again later."));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            chunks.push(chunk.subarray(0, chunk.length - (size - maxBytes)));
            response.destroy();
            return resolve({ type: String(response.headers["content-type"] ?? ""), body: Buffer.concat(chunks) });
          }
          chunks.push(chunk);
        });
        response.on("end", () => resolve({ type: String(response.headers["content-type"] ?? ""), body: Buffer.concat(chunks) }));
        response.on("error", reject);
      },
    );
    request.on("error", (error) => reject(error instanceof LinkProblem ? error : signal.aborted ? new LinkProblem("That site took too long to answer.") : new LinkProblem("Couldn't open that link. Check it and try again.")));
  });
}

const decodeEntities = (value: string) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, "&");

const isRecipeType = (type: unknown) => (Array.isArray(type) ? type : [type]).some((value) => typeof value === "string" && /(^|\/)Recipe$/.test(value));

/** Every object inside a JSON-LD value, depth first. */
function* objectsIn(value: unknown, depth = 0): Generator<Record<string, unknown>> {
  if (depth > 8 || !value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) yield* objectsIn(item, depth + 1);
    return;
  }
  yield value as Record<string, unknown>;
  for (const child of Object.values(value)) yield* objectsIn(child, depth + 1);
}

/** The schema.org Recipe most recipe sites put in the page for search engines, if there is one. */
export function findRecipeData(html: string): Record<string, unknown> | undefined {
  for (const [, body] of html.matchAll(/<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(body!.trim());
    } catch {
      continue;
    }
    for (const object of objectsIn(parsed)) if (isRecipeType(object["@type"])) return object;
  }
  return undefined;
}

const imageUrlOf = (value: unknown): string | undefined => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(imageUrlOf).find(Boolean);
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return imageUrlOf(object.url ?? object.contentUrl);
  }
  return undefined;
};

/** The dish picture: the recipe data's image, else the picture the page shows when shared (og:image). */
export function findImageUrl(html: string, data: Record<string, unknown> | undefined, base: URL): URL | undefined {
  const fromData = data && imageUrlOf(data.image);
  const meta = (name: string) =>
    new RegExp(`<meta[^>]+(?:property|name)\\s*=\\s*["']${name}["'][^>]*>`, "i").exec(html)?.[0].match(/content\s*=\s*["']([^"']+)["']/i)?.[1];
  const raw = fromData ?? meta("og:image") ?? meta("twitter:image");
  if (!raw) return undefined;
  const url = URL.parse(decodeEntities(raw), base);
  return url ? parseLink(url.href) : undefined;
}

/** The words of a page without scripts, styles and tags, for pages with no recipe data. */
export function pageText(html: string) {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "";
  const body = html
    .replace(/<(script|style|noscript|svg|template|iframe)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr)[^>]*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(`${title}\n${body}`)
    .replace(/[ \t\f\v\r]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim()
    .slice(0, maxTextChars);
}

/** The recipe data without what the model doesn't need (reviews, ratings, nutrition, video). */
export function trimRecipeData(data: Record<string, unknown>) {
  const keep = ["name", "description", "recipeYield", "yield", "totalTime", "prepTime", "cookTime", "recipeCategory", "recipeCuisine", "keywords", "recipeIngredient", "ingredients", "recipeInstructions", "suitableForDiet"];
  return JSON.stringify(Object.fromEntries(keep.filter((key) => key in data).map((key) => [key, data[key]]))).slice(0, maxTextChars);
}

/** What the model reads for one link: the recipe data when the page has it, else the page's words. */
export type LinkPage = { url: URL; text: string; structured: boolean; imageUrl: URL | undefined };

export async function readLinkPage(link: URL, signal: AbortSignal, open: OpenUrl = fetchPublic): Promise<LinkPage> {
  const page = await open(link, "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5", maxPageBytes, signal);
  if (!/html|xml|text\/plain/i.test(page.type) && page.type) throw new LinkProblem("That link isn't a web page. Paste the link to the recipe page.");
  const html = page.body.toString("utf8");
  const data = findRecipeData(html);
  const imageUrl = findImageUrl(html, data, page.url);
  if (data) return { url: page.url, text: trimRecipeData(data), structured: true, imageUrl };
  const text = pageText(html);
  if (text.length < 80) throw new LinkProblem("That page has almost no text we can read. It may need a login. Take a screenshot and use Photo to recipe instead.");
  return { url: page.url, text, structured: false, imageUrl };
}

/** The dish picture as a JPEG data URL like Photo to recipe's, or null if it can't be had. */
export async function fetchDishPhoto(url: URL | undefined, signal: AbortSignal, open: OpenUrl = fetchPublic): Promise<string | null> {
  if (!url) return null;
  try {
    const image = await open(url, "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8", maxImageBytes, signal);
    const bytes = await sharp(image.body, { failOn: "error" })
      .rotate()
      .resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    return `data:image/jpeg;base64,${bytes.toString("base64")}`;
  } catch {
    // The recipe is still worth having without its picture.
    return null;
  }
}
