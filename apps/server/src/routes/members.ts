import { AddMemberInput, MemberParams, OrgParams, ResetPasswordInput, UpdateMemberInput } from "@sm/shared";
import type { MemberSummary } from "@sm/shared";
import { and, eq, ne } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { audit } from "../audit.js";
import { requirePermission } from "../auth/context.js";
import { hashPassword } from "../auth/passwords.js";
import { revokeUserSessions } from "../auth/sessions.js";
import type { Db, DbOrTx } from "../db/client.js";
import { memberships, users } from "../db/schema.js";
import { HttpError, forbidden, notFound, parse } from "../errors.js";

const memberColumns = {
  userId: users.id,
  email: users.email,
  displayName: users.displayName,
  roles: memberships.roles,
  active: memberships.active,
  mustChangePassword: users.mustChangePassword,
  lastLoginAt: users.lastLoginAt,
};

type MemberRow = { lastLoginAt: Date | null } & Omit<MemberSummary, "lastLoginAt">;
const toSummary = (r: MemberRow): MemberSummary => ({ ...r, lastLoginAt: r.lastLoginAt?.toISOString() ?? null });

async function getMember(db: DbOrTx, orgId: string, userId: string): Promise<MemberSummary | null> {
  const [r] = await db
    .select(memberColumns)
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)));
  return r ? toSummary(r) : null;
}

async function otherActiveAdmins(db: DbOrTx, orgId: string, exceptUserId: string): Promise<number> {
  const rows = await db
    .select({ roles: memberships.roles })
    .from(memberships)
    .where(and(eq(memberships.orgId, orgId), eq(memberships.active, true), ne(memberships.userId, exceptUserId)));
  return rows.filter((r) => r.roles.includes("admin")).length;
}

export function memberRoutes(app: FastifyInstance, { db }: { db: Db }): void {
  app.get("/api/orgs/:orgId/members", async (req) => {
    const { orgId } = parse(OrgParams, req.params);
    requirePermission(req, orgId, "users.manage");
    const rows = await db
      .select(memberColumns)
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.orgId, orgId))
      .orderBy(users.displayName);
    return rows.map(toSummary);
  });

  app.post("/api/orgs/:orgId/members", async (req, reply) => {
    const { orgId } = parse(OrgParams, req.params);
    const { auth } = requirePermission(req, orgId, "users.manage");
    const input = parse(AddMemberInput, req.body);
    const [existing] = await db.select().from(users).where(eq(users.email, input.email));
    if (!existing && !input.password) {
      throw new HttpError(400, "Set a starting password for this new account.", "validation");
    }
    const passwordHash = !existing && input.password ? await hashPassword(input.password) : null;
    const userId = await db.transaction(async (tx) => {
      let id: string;
      if (existing) {
        const [m] = await tx
          .select()
          .from(memberships)
          .where(and(eq(memberships.userId, existing.id), eq(memberships.orgId, orgId)));
        if (m?.active) throw new HttpError(409, "That person is already in this organization.", "exists");
        if (m) {
          await tx
            .update(memberships)
            .set({ roles: input.roles, active: true, updatedAt: new Date() })
            .where(and(eq(memberships.userId, existing.id), eq(memberships.orgId, orgId)));
        } else {
          await tx.insert(memberships).values({ userId: existing.id, orgId, roles: input.roles });
        }
        id = existing.id;
      } else {
        const [u] = await tx
          .insert(users)
          .values({ email: input.email, displayName: input.displayName, passwordHash: passwordHash ?? "", mustChangePassword: true })
          .returning({ id: users.id });
        if (!u) throw new Error("User insert failed.");
        await tx.insert(memberships).values({ userId: u.id, orgId, roles: input.roles });
        id = u.id;
      }
      await audit(tx, {
        orgId,
        actorUserId: auth.user.id,
        action: "member.added",
        entityType: "user",
        entityId: id,
        after: { email: input.email, displayName: input.displayName, roles: input.roles, newAccount: !existing },
        ip: req.ip,
      });
      return id;
    });
    reply.status(201);
    return getMember(db, orgId, userId);
  });

  app.patch("/api/orgs/:orgId/members/:userId", async (req) => {
    const { orgId, userId } = parse(MemberParams, req.params);
    const { auth } = requirePermission(req, orgId, "users.manage");
    const input = parse(UpdateMemberInput, req.body);
    const before = await getMember(db, orgId, userId);
    if (!before) throw notFound("Member not found.");
    const roles = input.roles ?? before.roles;
    const active = input.active ?? before.active;
    const losesAdmin = before.active && before.roles.includes("admin") && (!active || !roles.includes("admin"));
    if (losesAdmin && userId === auth.user.id) {
      throw new HttpError(400, "You can't remove your own admin access.", "self_lockout");
    }
    if (losesAdmin && (await otherActiveAdmins(db, orgId, userId)) === 0) {
      throw new HttpError(400, "Each organization needs at least one active admin.", "last_admin");
    }
    await db.transaction(async (tx) => {
      if (input.displayName !== undefined) {
        await tx.update(users).set({ displayName: input.displayName, updatedAt: new Date() }).where(eq(users.id, userId));
      }
      await tx
        .update(memberships)
        .set({ roles, active, updatedAt: new Date() })
        .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)));
      if (before.active && !active) await revokeUserSessions(tx, userId);
      const after = await getMember(tx, orgId, userId);
      await audit(tx, { orgId, actorUserId: auth.user.id, action: "member.updated", entityType: "user", entityId: userId, before, after, ip: req.ip });
    });
    return getMember(db, orgId, userId);
  });

  app.post("/api/orgs/:orgId/members/:userId/reset-password", async (req) => {
    const { orgId, userId } = parse(MemberParams, req.params);
    const { auth } = requirePermission(req, orgId, "users.manage");
    const input = parse(ResetPasswordInput, req.body);
    if (userId === auth.user.id) {
      throw new HttpError(400, "Change your own password from your account page.", "self_reset");
    }
    if (!(await getMember(db, orgId, userId))) throw notFound("Member not found.");
    // A password is global to the account: only allowed if the actor is admin everywhere the person belongs.
    const theirOrgs = await db.select({ orgId: memberships.orgId }).from(memberships).where(eq(memberships.userId, userId));
    const adminOf = new Set(auth.user.memberships.filter((m) => m.roles.includes("admin")).map((m) => m.orgId));
    if (theirOrgs.some((o) => !adminOf.has(o.orgId))) {
      throw forbidden("This person also belongs to another organization, so only they (or an admin of every organization they're in) can reset their password.");
    }
    const passwordHash = await hashPassword(input.newPassword);
    await db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash, mustChangePassword: true, updatedAt: new Date() }).where(eq(users.id, userId));
      await revokeUserSessions(tx, userId);
      await audit(tx, { orgId, actorUserId: auth.user.id, action: "member.password_reset", entityType: "user", entityId: userId, ip: req.ip });
    });
    return { ok: true };
  });
}
