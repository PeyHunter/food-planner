import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Database } from "./db.ts";
import { secrets } from "./schema.ts";

export type SecretKind = "nemlig";

/** APP_SECRET_KEY is 32 random bytes in base64 (scripts/add-app-key.sh). Missing or wrong: the features that need it stay off. */
export function readSecretKey(value: string | undefined): Buffer | { error: string } {
  if (!value) return { error: "APP_SECRET_KEY is not set." };
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) return { error: `APP_SECRET_KEY must be 32 bytes in base64 (got ${key.length} bytes).` };
  return key;
}

/**
 * Secrets sealed with AES-256-GCM. The key lives in the sealed Kubernetes secret, never in the database.
 * The row's owner and kind are bound in as associated data, so a sealed value copied to another row won't open.
 */
export function secretStore({ db }: Database, now: () => Date, key: Buffer) {
  if (key.length !== 32) throw new Error("The secret key must be 32 bytes.");
  const label = (userId: string, kind: SecretKind) => Buffer.from(`${userId}:${kind}`);
  return {
    async put(userId: string, kind: SecretKind, plaintext: string) {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv).setAAD(label(userId, kind));
      const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
      const row = { ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), createdAt: now() };
      await db
        .insert(secrets)
        .values({ userId, kind, ...row })
        .onConflictDoUpdate({ target: [secrets.userId, secrets.kind], set: row });
    },
    async get(userId: string, kind: SecretKind): Promise<string | undefined> {
      const [row] = await db.select().from(secrets).where(and(eq(secrets.userId, userId), eq(secrets.kind, kind)));
      if (!row) return undefined;
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(row.iv, "base64")).setAAD(label(userId, kind));
      decipher.setAuthTag(Buffer.from(row.tag, "base64"));
      return Buffer.concat([decipher.update(Buffer.from(row.ciphertext, "base64")), decipher.final()]).toString("utf8");
    },
    async delete(userId: string, kind: SecretKind) {
      await db.delete(secrets).where(and(eq(secrets.userId, userId), eq(secrets.kind, kind)));
    },
  };
}
export type SecretStore = ReturnType<typeof secretStore>;
