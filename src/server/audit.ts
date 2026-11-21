import { desc, eq } from "drizzle-orm";
import type { Database } from "./db.ts";
import type { Activity } from "../shared/security.ts";
import { auditLog } from "./schema.ts";

/** What a login did, for Profile > Activity. Actions are short English phrases the web translates. */
export type AuditAction =
  | "Logged in with password"
  | "Logged in with passkey"
  | "Passkey added"
  | "Passkey removed"
  | "Device logged out"
  | "Logged out everywhere else";


export function auditTrail({ db }: Database, now: () => Date) {
  return {
    async audit(userId: string, action: AuditAction, detail = "") {
      await db.insert(auditLog).values({ userId, action, detail, at: now() });
    },
    async recent(userId: string, limit = 20): Promise<Activity[]> {
      const rows = await db.select().from(auditLog).where(eq(auditLog.userId, userId)).orderBy(desc(auditLog.at)).limit(limit);
      return rows.map((row) => ({ action: row.action, detail: row.detail, at: row.at.toISOString() }));
    },
  };
}
