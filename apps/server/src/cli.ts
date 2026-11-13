import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { createOrganizationWithAdmin } from "./accounts.js";
import { loadConfig } from "./config.js";
import { createDb, runMigrations } from "./db/client.js";
import { users } from "./db/schema.js";

const USAGE = 'Usage: node dist/cli.js create-admin --email you@example.com --name "Your Name" --org "Organization name"';

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { email: { type: "string" }, name: { type: "string" }, org: { type: "string" } },
  });
  if (positionals[0] !== "create-admin" || !values.email || !values.org) {
    console.error(USAGE);
    process.exit(1);
  }
  const { db, pool } = createDb(loadConfig().databaseUrl);
  try {
    await runMigrations(db);
    const email = values.email.trim().toLowerCase();
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    const password = randomBytes(9).toString("base64url");
    await createOrganizationWithAdmin(db, {
      orgName: values.org,
      email,
      displayName: values.name ?? email,
      password,
      mustChangePassword: true,
    });
    console.info(`Created organization "${values.org}" with admin ${email}.`);
    console.info(existing ? "That account already existed; its password is unchanged." : `Temporary password: ${password} (must be changed at first sign-in)`);
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
