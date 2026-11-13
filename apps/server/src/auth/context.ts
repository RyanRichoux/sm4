import { can } from "@sm/shared";
import type { MembershipSummary, Permission, Role, SessionUser } from "@sm/shared";
import { and, eq } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import type { DbOrTx } from "../db/client.js";
import { memberships, organizations, users } from "../db/schema.js";
import { HttpError, notFound, forbidden } from "../errors.js";

export interface AuthContext {
  sessionId: string;
  user: SessionUser;
}

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthContext | null;
  }
}

export async function loadSessionUser(db: DbOrTx, userId: string): Promise<SessionUser | null> {
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) return null;
  const rows = await db
    .select({ orgId: memberships.orgId, orgName: organizations.name, roles: memberships.roles })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.orgId))
    .where(and(eq(memberships.userId, userId), eq(memberships.active, true)))
    .orderBy(organizations.name);
  const ms: MembershipSummary[] = rows.map((r) => ({ orgId: r.orgId, orgName: r.orgName, roles: r.roles }));
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    mustChangePassword: u.mustChangePassword,
    memberships: ms,
  };
}

/** Signed-in user, or 401. Blocks everything except password change while a change is required. */
export function requireAuth(req: FastifyRequest, opts: { allowPasswordChange?: boolean } = {}): AuthContext {
  if (!req.auth) throw new HttpError(401, "Please sign in.", "unauthenticated");
  if (req.auth.user.mustChangePassword && !opts.allowPasswordChange) {
    throw new HttpError(403, "Change your password before continuing.", "password_change_required");
  }
  return req.auth;
}

/**
 * Signed-in member of `orgId` holding `permission`. Non-members get 404 so the
 * existence of other organizations isn't revealed.
 */
export function requirePermission(
  req: FastifyRequest,
  orgId: string,
  permission: Permission,
): { auth: AuthContext; roles: Role[] } {
  const auth = requireAuth(req);
  const m = auth.user.memberships.find((x) => x.orgId === orgId);
  if (!m) throw notFound("Organization not found.");
  if (!can(m.roles, permission)) throw forbidden();
  return { auth, roles: m.roles };
}
