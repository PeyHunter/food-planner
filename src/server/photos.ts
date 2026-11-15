import { randomUUID } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

// The pod has 256 MiB: one photo at a time, no decoded-image cache.
sharp.concurrency(1);
sharp.cache(false);

const maxSide = 1600;
const maxBytes = 400 * 1024;
const qualities = [75, 65, 55, 45];
/** Width of the smaller copy share pages show on phones. */
export const smallWidth = 800;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type StoredPhoto = { id: string; width: number; height: number; bytes: number };

export function photoStore(dir: string) {
  const pathOf = (id: string) => {
    if (!uuidPattern.test(id)) throw new Error(`Not a photo id: ${id}`);
    return join(dir, `${id}.jpg`);
  };
  const smallPathOf = (id: string) => pathOf(id).replace(/\.jpg$/, `-${smallWidth}.jpg`);
  const making = new Map<string, Promise<Buffer>>();

  return {
    /** Turns the photo upright, shrinks it to at most 1600 px on its long side and saves it as JPEG of at most 400 kB without its metadata (no GPS). */
    async save(input: Uint8Array): Promise<StoredPhoto> {
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

      const id = randomUUID();
      await writeFile(pathOf(id), photo.data);
      return { id, width: photo.info.width, height: photo.info.height, bytes: photo.data.length };
    },
    read: (id: string) => readFile(pathOf(id)),
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
    remove: async (id: string) => {
      await Promise.all([rm(pathOf(id), { force: true }), rm(smallPathOf(id), { force: true })]);
    },
    isPhotoId: (id: string) => uuidPattern.test(id),
  };
}

export type PhotoStore = ReturnType<typeof photoStore>;
