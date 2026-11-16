import { formatMinutes, type Recipe } from "../../shared/recipes.ts";
import { formatAmount } from "../../shared/units.ts";
import { t } from "../i18n.ts";

const width = 1080;
const pad = 64;
const ink = "#1d1a17";
const paper = "#fffdf7";
const accent = "#ffd166";
const font = (size: number, weight = 600) => `${weight} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;

/** Lines of text that fit `max` pixels wide. */
function wrap(context: CanvasRenderingContext2D, text: string, max: number) {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (context.measureText(next).width > max && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

const loadImage = (url: string) =>
  new Promise<HTMLImageElement | undefined>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(undefined);
    image.src = url;
  });

type Block = { text: string; size: number; weight?: number; gap: number; indent?: number; colour?: string };

/** The whole recipe as one tall JPEG, made on the phone: dish photo, title, ingredients and steps. */
export async function recipeImage(recipe: Recipe, words: { ingredients: string; steps: string; feeds: string }): Promise<Blob> {
  const photo = recipe.mainPhoto ? await loadImage(recipe.mainPhoto.url) : undefined;
  const photoHeight = photo ? Math.round((width * Math.min(photo.height, photo.width)) / photo.width) : 0;

  const blocks: Block[] = [{ text: recipe.title, size: 64, weight: 800, gap: 20 }];
  const facts = [words.feeds, recipe.minutes ? formatMinutes(recipe.minutes) : ""].filter(Boolean).join(" · ");
  blocks.push({ text: facts, size: 32, gap: 24, colour: "#5c554d" });
  if (recipe.description) blocks.push({ text: recipe.description, size: 32, weight: 400, gap: 32 });
  blocks.push({ text: words.ingredients, size: 44, weight: 800, gap: 16 });
  for (const line of recipe.lines) {
    const amount = line.amount !== null && line.unit !== null ? `${formatAmount(line.amount, line.unit)} ${t(line.unit)} ` : "";
    blocks.push({ text: `• ${amount}${line.ingredient.name}${line.note ? `, ${line.note}` : ""}`, size: 34, weight: 500, gap: 8 });
  }
  blocks.push({ text: "", size: 16, gap: 16 });
  blocks.push({ text: words.steps, size: 44, weight: 800, gap: 16 });
  recipe.steps.forEach((step, index) => blocks.push({ text: `${index + 1}. ${step}`, size: 34, weight: 400, gap: 16 }));

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d")!;
  const laid = blocks.map((block) => {
    context.font = font(block.size, block.weight);
    return { ...block, lines: block.text ? wrap(context, block.text, width - pad * 2) : [""] };
  });
  const textHeight = laid.reduce((sum, block) => sum + block.lines.length * block.size * 1.3 + block.gap, 0);
  canvas.width = width;
  // iOS Safari refuses a canvas over about 16.7 million pixels: 1080 × 15000 stays under it.
  canvas.height = Math.min(15000, photoHeight + pad * 2 + textHeight + 40);

  context.fillStyle = paper;
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (photo) {
    // A square-ish crop from the middle of the dish photo.
    const sourceHeight = Math.min(photo.height, photo.width);
    context.drawImage(photo, 0, (photo.height - sourceHeight) / 2, photo.width, sourceHeight, 0, 0, width, photoHeight);
  }
  context.fillStyle = accent;
  context.fillRect(0, photoHeight, width, 14);

  let y = photoHeight + pad;
  context.textBaseline = "top";
  for (const block of laid) {
    context.font = font(block.size, block.weight);
    context.fillStyle = block.colour ?? ink;
    for (const line of block.lines) {
      context.fillText(line, pad, y);
      y += block.size * 1.3;
    }
    y += block.gap;
  }
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not make the picture."))), "image/jpeg", 0.85));
}
