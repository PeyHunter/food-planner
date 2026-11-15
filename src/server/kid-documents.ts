import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { and, desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { KidDocument } from "../shared/children.ts";
import type { AppDependencies } from "./app.ts";
import { kitchenMember, type MemberEnv } from "./recipes.ts";
import { kidDocuments, users } from "./schema.ts";

const megabyte = 1024 * 1024;
const maxBytes = 25 * megabyte;
const maxPerKitchen = 50;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const types = {
  pdf: { media: "application/pdf", ext: "pdf" },
  jpeg: { media: "image/jpeg", ext: "jpg" },
  png: { media: "image/png", ext: "png" },
  webp: { media: "image/webp", ext: "webp" },
} as const;
type FileType = keyof typeof types;

/** What the file is, from its first bytes; a name ending in .pdf proves nothing. */
export function sniffType(bytes: Uint8Array): FileType | undefined {
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  if (starts(0x25, 0x50, 0x44, 0x46, 0x2d)) return "pdf"; // %PDF-
  if (starts(0xff, 0xd8, 0xff)) return "jpeg";
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "png";
  if (starts(0x52, 0x49, 0x46, 0x46) && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP") return "webp";
  return undefined;
}

/** "Kostplan 6-12 mdr.pdf" → "Kostplan 6-12 mdr". */
const titleFrom = (value: unknown, fileName: string) => {
  const typed = typeof value === "string" ? value.trim() : "";
  return (typed || fileName.replace(/\.[a-z0-9]{2,5}$/i, "").trim() || "Food plan").slice(0, 120);
};

export function createKidDocumentRoutes({ database, now, photosDir }: AppDependencies) {
  const { db } = database;
  const routes = new Hono<MemberEnv>();
  const member = kitchenMember({ database, now });
  const folder = join(photosDir, "documents");
  const pathOf = (id: string, type: FileType) => join(folder, `${id}.${types[type].ext}`);

  async function ownDocument(kitchenId: string, id: string) {
    if (!uuidPattern.test(id)) return undefined;
    const [row] = await db
      .select({ id: kidDocuments.id, title: kidDocuments.title, fileType: kidDocuments.fileType })
      .from(kidDocuments)
      .where(and(eq(kidDocuments.id, id), eq(kidDocuments.kitchenId, kitchenId)));
    return row && { ...row, fileType: row.fileType as FileType };
  }

  routes.get("/api/kid-documents", member, async (c) => {
    const rows = await db
      .select({ id: kidDocuments.id, title: kidDocuments.title, fileType: kidDocuments.fileType, bytes: kidDocuments.bytes, createdAt: kidDocuments.createdAt, by: sql<string>`coalesce(${users.username}, '')` })
      .from(kidDocuments)
      .leftJoin(users, eq(users.id, kidDocuments.createdBy))
      .where(eq(kidDocuments.kitchenId, c.get("member").kitchenId))
      .orderBy(desc(kidDocuments.createdAt));
    return c.json(rows.map((row): KidDocument => ({ ...row, fileType: row.fileType as FileType, createdAt: row.createdAt.toISOString(), url: `/api/kid-documents/${row.id}/file` })));
  });

  routes.post("/api/kid-documents", member, bodyLimit({ maxSize: maxBytes + megabyte, onError: (c) => c.json({ error: "That file is too big. Keep it under 25 MB." }, 413) }), async (c) => {
    const { kitchenId, userId, kids } = c.get("member");
    if (!kids) return c.json({ error: "This kitchen has no children." }, 403);
    const body = await c.req.parseBody();
    if (!(body.file instanceof File)) return c.json({ error: "Pick a file first." }, 400);
    const bytes = new Uint8Array(await body.file.arrayBuffer());
    if (bytes.length > maxBytes) return c.json({ error: "That file is too big. Keep it under 25 MB." }, 413);
    const type = sniffType(bytes);
    if (!type) return c.json({ error: "That isn't a PDF or a photo we can keep. Try a PDF, JPEG or PNG." }, 400);
    const [{ count }] = (await db.select({ count: sql<number>`count(*)::int` }).from(kidDocuments).where(eq(kidDocuments.kitchenId, kitchenId))) as [{ count: number }];
    if (count >= maxPerKitchen) return c.json({ error: `You can keep up to ${maxPerKitchen} papers. Remove an old one first.` }, 409);

    await mkdir(folder, { recursive: true });
    const [row] = await db
      .insert(kidDocuments)
      .values({ kitchenId, title: titleFrom(body.title, body.file.name), fileType: type, bytes: bytes.length, createdBy: userId })
      .returning({ id: kidDocuments.id });
    try {
      await writeFile(pathOf(row!.id, type), bytes);
    } catch (error) {
      await db.delete(kidDocuments).where(eq(kidDocuments.id, row!.id));
      throw error;
    }
    return c.json({ id: row!.id }, 201);
  });

  routes.get("/api/kid-documents/:id/file", member, async (c) => {
    const found = await ownDocument(c.get("member").kitchenId, c.req.param("id"));
    if (!found) return c.json({ error: "No such paper." }, 404);
    const file = await readFile(pathOf(found.id, found.fileType)).catch(() => undefined);
    if (!file) return c.json({ error: "The file is missing." }, 404);
    const name = `${found.title.replace(/[^\p{L}\p{N} ._-]/gu, "").trim() || "food-plan"}.${types[found.fileType].ext}`;
    return c.body(new Uint8Array(file), 200, {
      "content-type": types[found.fileType].media,
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, max-age=3600",
    });
  });

  routes.delete("/api/kid-documents/:id", member, async (c) => {
    const found = await ownDocument(c.get("member").kitchenId, c.req.param("id"));
    if (!found) return c.json({ error: "No such paper." }, 404);
    await db.delete(kidDocuments).where(eq(kidDocuments.id, found.id));
    await rm(pathOf(found.id, found.fileType), { force: true });
    return c.body(null, 204);
  });

  return routes;
}
