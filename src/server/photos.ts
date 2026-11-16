import { randomUUID } from "node:crypto";
import { copyFile, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { eq, gt, or } from "drizzle-orm";
import sharp from "sharp";
import type { Database } from "./db.ts";
import { photos } from "./schema.ts";

// The pod has 256 MiB: one photo at a time, no decoded-image cache.
sharp.concurrency(1);
sharp.cache(false);

// Small enough that the photo volume stays small, big enough for a phone screen.
export const maxSide = 1280;
export const maxBytes = 250 * 1024;
const qualities = [75, 65, 55, 45];
/** Width of the smaller copy share pages show on phones. */
export const smallWidth = 800;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** "<id>.jpg" is the photo, "<id>-800.jpg" its small copy. Undefined for anything else. */
export function sharePhotoFile(file: string): { id: string; small: boolean } | undefined {
  const [, id, size] = /^(.{36})(-\d+)?(?:\.jpg)?$/.exec(file) ?? [];
  if (!id || !uuidPattern.test(id) || (size && size !== `-${smallWidth}`)) return undefined;
  return { id, small: Boolean(size) };
}

export type StoredPhoto = { id: string; width: number; height: number; bytes: number };

export function photoStore(dir: string) {
  const pathOf = (id: string) => {
    if (!uuidPattern.test(id)) throw new Error(`Not a photo id: ${id}`);
    return join(dir, `${id}.jpg`);
  };
  const smallPathOf = (id: string) => pathOf(id).replace(/\.jpg$/, `-${smallWidth}.jpg`);
  const making = new Map<string, Promise<Buffer>>();

  return {
    /** Turns the photo upright, shrinks it to at most 1280 px on its long side and saves it as JPEG of at most 250 kB without its metadata (no GPS). */
    async save(input: Uint8Array, id: string = randomUUID()): Promise<StoredPhoto> {
      const { data: pixels, info } = await sharp(input, { failOn: "error" })
        .rotate()
        .resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true })
        .raw()
        .toBuffer({ resolveWithObject: true });
      const raw = { width: info.width, height: info.height, channels: info.channels };
      const encode = (quality: number, width = raw.width, height = raw.height) =>
        sharp(pixels, { raw })
          .resize({ width, height, fit: "inside" })
          .jpeg({ quality, mozjpeg: true })
          .toBuffer({ resolveWithObject: true });

      // Lower the quality first, then the size, until it fits.
      let photo = await encode(qualities[0]!);
      for (const quality of qualities.slice(1)) {
        if (photo.data.length <= maxBytes) break;
        photo = await encode(quality);
      }
      let scale = 1;
      while (photo.data.length > maxBytes && scale > 0.1) {
        scale *= 0.85;
        photo = await encode(qualities.at(-1)!, Math.round(raw.width * scale), Math.round(raw.height * scale));
      }

      // Written under another name first, so a half-written file is never served.
      const part = `${pathOf(id)}.${randomUUID()}.part`;
      await writeFile(part, photo.data);
      await rename(part, pathOf(id));
      return { id, width: photo.info.width, height: photo.info.height, bytes: photo.data.length };
    },
    read: (id: string) => readFile(pathOf(id)),
    /** Saves a photo from before the size limits again, smaller, under the same id. Its small copy is made again too. */
    async shrink(id: string): Promise<StoredPhoto> {
      const stored = await this.save(await readFile(pathOf(id)), id);
      await rm(smallPathOf(id), { force: true });
      return stored;
    },
    /** An 800 px wide copy, made the first time it is asked for and kept next to the photo. */
    async readSmall(id: string): Promise<Buffer> {
      const kept = await readFile(smallPathOf(id)).catch(() => undefined);
      if (kept) return kept;
      let job = making.get(id);
      if (!job) {
        job = (async () => {
          const data = await sharp(await readFile(pathOf(id)))
            .resize({ width: smallWidth, withoutEnlargement: true })
            .jpeg({ quality: 70, mozjpeg: true })
            .toBuffer();
          // Written under another name first, so a half-written file is never served.
          const part = `${smallPathOf(id)}.${randomUUID()}.part`;
          await writeFile(part, data);
          await rename(part, smallPathOf(id));
          return data;
        })().finally(() => making.delete(id));
        making.set(id, job);
      }
      return job;
    },
    /** A new photo with the same picture, for a recipe copied into another kitchen. */
    async copy(id: string): Promise<string> {
      const copyId = randomUUID();
      await copyFile(pathOf(id), pathOf(copyId));
      return copyId;
    },
    remove: async (id: string) => {
      await Promise.all([rm(pathOf(id), { force: true }), rm(smallPathOf(id), { force: true })]);
    },
    isPhotoId: (id: string) => uuidPattern.test(id),
  };
}

export type PhotoStore = ReturnType<typeof photoStore>;

/** Makes every photo that is bigger than today's limits smaller, and updates its row. Returns how many it shrank. */
export async function shrinkOldPhotos({ db }: Database, store: PhotoStore): Promise<number> {
  const old = await db
    .select({ id: photos.id })
    .from(photos)
    .where(or(gt(photos.bytes, maxBytes), gt(photos.width, maxSide), gt(photos.height, maxSide)));
  let shrunk = 0;
  for (const { id } of old) {
    const stored = await store.shrink(id).catch((error: unknown) => {
      console.error(`Could not shrink photo ${id}:`, error);
      return undefined;
    });
    if (!stored) continue;
    await db.update(photos).set({ width: stored.width, height: stored.height, bytes: stored.bytes }).where(eq(photos.id, id));
    shrunk++;
  }
  if (shrunk) console.log(`Shrank ${shrunk} old photos.`);
  return shrunk;
}
