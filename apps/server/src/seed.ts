// Demo data for local development. Refuses to run in production.
import type { Role } from "@sm/shared";
import { eq } from "drizzle-orm";
import { createOrganizationWithAdmin } from "./accounts.js";
import { hashPassword } from "./auth/passwords.js";
import { loadConfig } from "./config.js";
import { createDb, runMigrations } from "./db/client.js";
import { memberships, organizations, users } from "./db/schema.js";

const PASSWORD = "demo-password-123";

async function main(): Promise<void> {
  const config = loadConfig();
  if (config.nodeEnv === "production") throw new Error("Refusing to seed demo data in production.");
  const { db, pool } = createDb(config.databaseUrl);
  try {
    await runMigrations(db);
    const [found] = await db.select().from(organizations).where(eq(organizations.name, "Demo Promotions"));
    const orgId =
      found?.id ??
      (await createOrganizationWithAdmin(db, {
        orgName: "Demo Promotions",
        email: "admin@demo.test",
        displayName: "Demo Admin",
        password: PASSWORD,
        mustChangePassword: false,
      })).orgId;
    const extra: { email: string; displayName: string; roles: Role[] }[] = [
      { email: "matchmaker@demo.test", displayName: "Demo Matchmaker", roles: ["matchmaker"] },
      { email: "checkin@demo.test", displayName: "Demo Check-in", roles: ["checkin"] },
    ];
    const passwordHash = await hashPassword(PASSWORD);
    for (const u of extra) {
      const [existing] = await db.select().from(users).where(eq(users.email, u.email));
      if (existing) continue;
      const [created] = await db.insert(users).values({ email: u.email, displayName: u.displayName, passwordHash }).returning();
      if (created) await db.insert(memberships).values({ userId: created.id, orgId, roles: u.roles });
    }
    console.info(`Demo users (password "${PASSWORD}"): admin@demo.test, matchmaker@demo.test, checkin@demo.test`);
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
