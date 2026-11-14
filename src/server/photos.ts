import { randomUUID } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

// The pod has 256 MiB: one photo at a time, no decoded-image cache.
sharp.concurrency(1);
sharp.cache(false);

const maxSide = 1600;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type StoredPhoto = { id: string; width: number; height: number; bytes: number };

export function photoStore(dir: string) {
  const pathOf = (id: string) => {
    if (!uuidPattern.test(id)) throw new Error(`Not a photo id: ${id}`);
    return join(dir, `${id}.jpg`);
  };

  return {
    /** Turns the photo upright, shrinks it to at most 1600 px on its long side and saves it as JPEG without its metadata (no GPS). */
    async save(input: Uint8Array): Promise<StoredPhoto> {
      const { data, info } = await sharp(input, { failOn: "error" })
        .rotate()
        .resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 75, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });
      const id = randomUUID();
      await writeFile(pathOf(id), data);
      return { id, width: info.width, height: info.height, bytes: data.length };
    },
    read: (id: string) => readFile(pathOf(id)),
    remove: (id: string) => rm(pathOf(id), { force: true }),
    isPhotoId: (id: string) => uuidPattern.test(id),
  };
}

export type PhotoStore = ReturnType<typeof photoStore>;
