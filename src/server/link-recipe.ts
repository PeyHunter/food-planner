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
  // An IPv4 address written as IPv6 (::ffff:10.0.0.1, ::ffff:a00:1, ::a00:1) is never a real website.
  if (/^::(ffff:)?(\d+\.\d+\.\d+\.\d+|[0-9a-f]{1,4}:[0-9a-f]{1,4})$/i.test(address)) return true;
  return privateNets.check(address, "ipv6");
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

/** A character from its number, or the text unchanged if the number isn't a real character. */
const character = (code: number, text: string) => (Number.isInteger(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : text);

const decodeEntities = (value: string) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d{1,8});/g, (text, code: string) => character(Number(code), text))
    .replace(/&#x([0-9a-f]{1,8});/gi, (text, code: string) => character(parseInt(code, 16), text))
    .replace(/&amp;/g, "&");

// Pages can be broken or hostile, so tags are found by scanning left to right with indexOf, never with
// backtracking patterns: the work stays in proportion to the page's size.

/** Each `<name ...>` tag: its text up to `>`, and where the text after it starts. */
function* openTags(html: string, lower: string, name: string) {
  let at = 0;
  while ((at = lower.indexOf(`<${name}`, at)) !== -1) {
    const after = lower.charAt(at + name.length + 1);
    const close = lower.indexOf(">", at);
    if (close === -1) return;
    if (after === ">" || after === "/" || /\s/.test(after)) yield { tag: html.slice(at, close + 1), end: close + 1 };
    at = close + 1;
  }
}

/** An attribute's value from one tag's text, e.g. content="…". */
function attribute(tag: string, name: string) {
  const lower = tag.toLowerCase();
  let at = 0;
  while ((at = lower.indexOf(name, at)) !== -1) {
    const before = lower.charAt(at - 1);
    let next = at + name.length;
    at = next;
    if (before && !/\s/.test(before)) continue;
    while (/\s/.test(lower.charAt(next))) next++;
    if (lower.charAt(next) !== "=") continue;
    next++;
    while (/\s/.test(lower.charAt(next))) next++;
    const quote = tag.charAt(next);
    if (quote === '"' || quote === "'") {
      const end = tag.indexOf(quote, next + 1);
      return end === -1 ? undefined : tag.slice(next + 1, end);
    }
    const end = tag.slice(next).search(/[\s>]/);
    return tag.slice(next, end === -1 ? undefined : next + end);
  }
  return undefined;
}


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
  const lower = html.toLowerCase();
  let at = 0;
  // Each script's search for its </script starts after the previous one's, so the page is read once.
  while ((at = lower.indexOf("<script", at)) !== -1) {
    const tagEnd = lower.indexOf(">", at);
    if (tagEnd === -1) return undefined;
    const close = lower.indexOf("</script", tagEnd + 1);
    if (close === -1) return undefined;
    const tag = html.slice(at, tagEnd + 1);
    const body = html.slice(tagEnd + 1, close);
    at = close + 8;
    if (!/^<script[\s>]/i.test(tag) || !/application\/ld\+json/i.test(attribute(tag, "type") ?? "")) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(body.trim());
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
  const metas = [...openTags(html, html.toLowerCase(), "meta")].map(({ tag }) => tag);
  const meta = (name: string) => {
    const tag = metas.find((text) => (attribute(text, "property") ?? attribute(text, "name"))?.toLowerCase() === name);
    return tag && attribute(tag, "content");
  };
  const raw = fromData ?? meta("og:image") ?? meta("twitter:image");
  if (!raw) return undefined;
  const url = URL.parse(decodeEntities(raw), base);
  return url ? parseLink(url.href) : undefined;
}

/** The words of a page without scripts, styles and tags, for pages with no recipe data. */
export function pageText(html: string) {
  const lower = html.toLowerCase();
  const titleTag = openTags(html, lower, "title").next().value;
  const titleEnd = titleTag ? lower.indexOf("</title", titleTag.end) : -1;
  const title = titleTag && titleEnd !== -1 ? html.slice(titleTag.end, titleEnd) : "";
  const skipped = new Set(["title", "script", "style", "noscript", "svg", "template", "iframe"]);
  const newline = new Set(["br", "/p", "/div", "/li", "/h1", "/h2", "/h3", "/h4", "/h5", "/h6", "/tr"]);
  let text = "";
  let at = 0;
  while (at < html.length && text.length < maxTextChars * 2) {
    const open = lower.indexOf("<", at);
    if (open === -1) {
      text += html.slice(at);
      break;
    }
    text += html.slice(at, open);
    if (lower.startsWith("<!--", open)) {
      const end = lower.indexOf("-->", open + 4);
      if (end === -1) break;
      at = end + 3;
      continue;
    }
    const close = lower.indexOf(">", open);
    if (close === -1) break;
    const name = /^\/?[a-z0-9]*/.exec(lower.slice(open + 1, Math.min(close, open + 12)))![0];
    at = close + 1;
    if (skipped.has(name)) {
      const end = lower.indexOf(`</${name}`, at);
      if (end === -1) break;
      const endClose = lower.indexOf(">", end);
      at = endClose === -1 ? html.length : endClose + 1;
      text += " ";
    } else text += name === "li" ? "\n- " : newline.has(name) ? "\n" : " ";
  }
  return decodeEntities(`${title}\n${text}`)
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
    // 40 megapixels is far more than any real dish photo; it keeps a tiny file from unpacking into gigabytes.
    const bytes = await sharp(image.body, { failOn: "error", limitInputPixels: 40_000_000 })
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
