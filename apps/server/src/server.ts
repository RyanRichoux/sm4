import { countUsers, createOrganizationWithAdmin } from "./accounts.js";
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDb, runMigrations } from "./db/client.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const { db, pool } = createDb(config.databaseUrl);
  await runMigrations(db);
  const app = await buildApp(config, db);

  if (config.bootstrap && (await countUsers(db)) === 0) {
    if (config.bootstrap.password.length < 10) throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at least 10 characters.");
    await createOrganizationWithAdmin(db, {
      orgName: config.bootstrap.orgName,
      email: config.bootstrap.email,
      displayName: config.bootstrap.name,
      password: config.bootstrap.password,
      mustChangePassword: true,
    });
    app.log.info(`Created organization "${config.bootstrap.orgName}" with admin ${config.bootstrap.email}`);
  }

  await app.listen({ port: config.port, host: config.host });

  const shutdown = async (signal: string) => {
    app.log.info(`${signal} received, shutting down`);
    await app.close();
    await pool.end();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
