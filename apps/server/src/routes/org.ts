import { AuditQuery, OrgParams, UpdateOrgInput, permissionsFor } from "@sm/shared";
import type { AuditEntry, OrgDetails } from "@sm/shared";
import { and, desc, eq, lt } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { audit } from "../audit.js";
import { requirePermission } from "../auth/context.js";
import type { Db } from "../db/client.js";
import { auditLog, organizations, users } from "../db/schema.js";
import { notFound, parse } from "../errors.js";

export function orgRoutes(app: FastifyInstance, { db }: { db: Db }): void {
  app.get("/api/orgs/:orgId", async (req): Promise<OrgDetails> => {
    const { orgId } = parse(OrgParams, req.params);
    const { roles } = requirePermission(req, orgId, "org.read");
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    if (!org) throw notFound("Organization not found.");
    return { id: org.id, name: org.name, roles, permissions: permissionsFor(roles) };
  });

  app.patch("/api/orgs/:orgId", async (req): Promise<OrgDetails> => {
    const { orgId } = parse(OrgParams, req.params);
    const { auth, roles } = requirePermission(req, orgId, "org.manage");
    const input = parse(UpdateOrgInput, req.body);
    const updated = await db.transaction(async (tx) => {
      const [before] = await tx.select().from(organizations).where(eq(organizations.id, orgId));
      if (!before) throw notFound("Organization not found.");
      const [after] = await tx
        .update(organizations)
        .set({ name: input.name, updatedAt: new Date() })
        .where(eq(organizations.id, orgId))
        .returning();
      await audit(tx, {
        orgId,
        actorUserId: auth.user.id,
        action: "org.updated",
        entityType: "organization",
        entityId: orgId,
        before: { name: before.name },
        after: { name: input.name },
        ip: req.ip,
      });
      return after;
    });
    if (!updated) throw notFound("Organization not found.");
    return { id: updated.id, name: updated.name, roles, permissions: permissionsFor(roles) };
  });

  app.get("/api/orgs/:orgId/audit", async (req): Promise<AuditEntry[]> => {
    const { orgId } = parse(OrgParams, req.params);
    requirePermission(req, orgId, "audit.read");
    const q = parse(AuditQuery, req.query);
    const rows = await db
      .select({
        id: auditLog.id,
        at: auditLog.at,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        actorUserId: auditLog.actorUserId,
        actorName: users.displayName,
        before: auditLog.before,
        after: auditLog.after,
      })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.actorUserId))
      .where(q.before ? and(eq(auditLog.orgId, orgId), lt(auditLog.id, q.before)) : eq(auditLog.orgId, orgId))
      .orderBy(desc(auditLog.id))
      .limit(q.limit);
    return rows.map((r) => ({ ...r, at: r.at.toISOString() }));
  });
}
