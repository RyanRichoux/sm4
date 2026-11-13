import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { createOrganizationWithAdmin } from "../src/accounts.js";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import type { Db } from "../src/db/client.js";
import { createDb, runMigrations } from "../src/db/client.js";

const BASE = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/postgres";
export const PW = "correct-horse-battery";

export interface TestCtx {
  app: FastifyInstance;
  db: Db;
  close(): Promise<void>;
}

/** A fresh database per test file, fully migrated. */
export async function setup(extraEnv: Record<string, string> = {}): Promise<TestCtx> {
  const name = `sm_test_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const admin = new pg.Client({ connectionString: BASE });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();
  const url = new URL(BASE);
  url.pathname = `/${name}`;
  const { db, pool } = createDb(url.toString());
  await runMigrations(db);
  const config = loadConfig({
    NODE_ENV: "test",
    DATABASE_URL: url.toString(),
    COOKIE_SECURE: "false",
    LOGIN_RATE_LIMIT: "100",
    ...extraEnv,
  });
  const app = await buildApp(config, db);
  await app.ready();
  return {
    app,
    db,
    async close() {
      await app.close();
      await pool.end();
      const c = new pg.Client({ connectionString: BASE });
      await c.connect();
      await c.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await c.end();
    },
  };
}

export function makeOrg(db: Db, orgName: string, email: string) {
  return createOrganizationWithAdmin(db, { orgName, email, displayName: `${orgName} Admin`, password: PW, mustChangePassword: false });
}

// Test-only: response bodies are checked field by field, so a loose type is fine here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;
type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
export interface Res {
  status: number;
  json: Json;
  headers: Record<string, string | string[] | number | undefined>;
}
export interface Client {
  cookie: string;
  req(method: Method, url: string, body?: unknown, headers?: Record<string, string>): Promise<Res>;
}

export function client(app: FastifyInstance, cookie = ""): Client {
  return {
    cookie,
    async req(method, url, body, headers = {}) {
      const r = await app.inject({
        method,
        url,
        headers: { ...(cookie ? { cookie } : {}), ...headers },
        ...(body !== undefined ? { payload: body as object } : {}),
      });
      return { status: r.statusCode, json: r.body ? JSON.parse(r.body) : null, headers: r.headers };
    },
  };
}

export async function login(app: FastifyInstance, email: string, password = PW): Promise<Client> {
  const r = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email, password } });
  if (r.statusCode !== 200) throw new Error(`login failed for ${email}: ${r.statusCode} ${r.body}`);
  const raw = r.headers["set-cookie"];
  const first = Array.isArray(raw) ? raw[0] : raw;
  return client(app, String(first).split(";")[0] ?? "");
}
