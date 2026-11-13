import { and, eq, gt, ne } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import type { DbOrTx } from "../db/client.js";
import { sessions } from "../db/schema.js";

export const SESSION_COOKIE = "sm_session";
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(
  db: DbOrTx,
  userId: string,
  days: number,
  meta: { ip: string | null; userAgent: string | null },
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.insert(sessions).values({
    id: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + days * 86_400_000),
    ip: meta.ip,
    userAgent: meta.userAgent?.slice(0, 300) ?? null,
  });
  return token;
}

export async function findSession(db: DbOrTx, token: string): Promise<{ id: string; userId: string } | null> {
  const id = hashToken(token);
  const [row] = await db
    .select({ id: sessions.id, userId: sessions.userId, lastSeenAt: sessions.lastSeenAt })
    .from(sessions)
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())));
  if (!row) return null;
  if (Date.now() - row.lastSeenAt.getTime() > 5 * 60_000) {
    await db.update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.id, id));
  }
  return { id: row.id, userId: row.userId };
}

export async function deleteSessionById(db: DbOrTx, id: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, id));
}

/** Sign a user out everywhere, optionally keeping the current session. */
export async function revokeUserSessions(db: DbOrTx, userId: string, keepSessionId?: string): Promise<void> {
  await db
    .delete(sessions)
    .where(keepSessionId ? and(eq(sessions.userId, userId), ne(sessions.id, keepSessionId)) : eq(sessions.userId, userId));
}
