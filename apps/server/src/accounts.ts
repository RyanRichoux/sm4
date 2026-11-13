import type { Role } from "@sm/shared";
import { eq } from "drizzle-orm";
import { audit } from "./audit.js";
import { hashPassword } from "./auth/passwords.js";
import type { Db } from "./db/client.js";
import { memberships, organizations, users } from "./db/schema.js";

/** Create an organization with its first admin. Used by bootstrap, the CLI, seeding and tests. */
export async function createOrganizationWithAdmin(
  db: Db,
  input: { orgName: string; email: string; displayName: string; password: string; mustChangePassword: boolean },
): Promise<{ orgId: string; userId: string }> {
  const passwordHash = await hashPassword(input.password);
  return db.transaction(async (tx) => {
    const [org] = await tx.insert(organizations).values({ name: input.orgName }).returning();
    const email = input.email.trim().toLowerCase();
    let [user] = await tx.select().from(users).where(eq(users.email, email));
    if (!user) {
      [user] = await tx
        .insert(users)
        .values({ email, displayName: input.displayName, passwordHash, mustChangePassword: input.mustChangePassword })
        .returning();
    }
    if (!org || !user) throw new Error("Failed to create organization.");
    const roles: Role[] = ["admin"];
    await tx.insert(memberships).values({ userId: user.id, orgId: org.id, roles });
    await audit(tx, {
      orgId: org.id,
      actorUserId: null,
      action: "org.created",
      entityType: "organization",
      entityId: org.id,
      after: { name: org.name, admin: email },
    });
    return { orgId: org.id, userId: user.id };
  });
}

export async function countUsers(db: Db): Promise<number> {
  const rows = await db.select({ id: users.id }).from(users).limit(1);
  return rows.length;
}
