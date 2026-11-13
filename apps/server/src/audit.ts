import type { DbOrTx } from "./db/client.js";
import { auditLog } from "./db/schema.js";

const SECRET_KEYS = new Set(["password", "passwordHash", "newPassword", "currentPassword", "token"]);

function scrub(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(scrub);
  if (v && typeof v === "object" && !(v instanceof Date)) {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .filter(([k]) => !SECRET_KEYS.has(k))
        .map(([k, val]) => [k, scrub(val)]),
    );
  }
  return v;
}

export interface AuditInput {
  orgId: string | null;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}

/** Record a change. Call inside the same transaction as the change itself. */
export async function audit(db: DbOrTx, e: AuditInput): Promise<void> {
  await db.insert(auditLog).values({
    orgId: e.orgId,
    actorUserId: e.actorUserId,
    action: e.action,
    entityType: e.entityType,
    entityId: e.entityId,
    before: e.before === undefined ? null : scrub(e.before),
    after: e.after === undefined ? null : scrub(e.after),
    ip: e.ip ?? null,
  });
}
