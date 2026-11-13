import { z } from "zod";

const Env = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().min(1, { error: "DATABASE_URL is required." }),
  /** Defaults to true in production. Set false only for plain-HTTP local development. */
  COOKIE_SECURE: z.enum(["true", "false"]).optional(),
  SESSION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  TRUST_PROXY: z.enum(["true", "false"]).default("true"),
  /** Folder with the built web app; when set, the server serves it. */
  WEB_DIST: z.string().optional(),
  /** Extra origins allowed to make changes (comma-separated), e.g. https://matchmaker.tail1234.ts.net */
  ALLOWED_ORIGINS: z.string().optional(),
  LOGIN_RATE_LIMIT: z.coerce.number().int().min(1).default(10),
  BOOTSTRAP_ADMIN_EMAIL: z.string().optional(),
  BOOTSTRAP_ADMIN_NAME: z.string().optional(),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().optional(),
  BOOTSTRAP_ORG_NAME: z.string().optional(),
});

export interface Config {
  nodeEnv: "development" | "test" | "production";
  port: number;
  host: string;
  databaseUrl: string;
  cookieSecure: boolean;
  sessionDays: number;
  trustProxy: boolean;
  webDist: string | undefined;
  allowedOrigins: string[];
  loginRateLimit: number;
  bootstrap:
    | { email: string; name: string; password: string; orgName: string }
    | undefined;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = Env.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid configuration: ${msg}`);
  }
  const e = parsed.data;
  return {
    nodeEnv: e.NODE_ENV,
    port: e.PORT,
    host: e.HOST,
    databaseUrl: e.DATABASE_URL,
    cookieSecure: e.COOKIE_SECURE ? e.COOKIE_SECURE === "true" : e.NODE_ENV === "production",
    sessionDays: e.SESSION_DAYS,
    trustProxy: e.TRUST_PROXY === "true",
    webDist: e.WEB_DIST || undefined,
    allowedOrigins: (e.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    loginRateLimit: e.LOGIN_RATE_LIMIT,
    bootstrap:
      e.BOOTSTRAP_ADMIN_EMAIL && e.BOOTSTRAP_ADMIN_PASSWORD
        ? {
            email: e.BOOTSTRAP_ADMIN_EMAIL,
            name: e.BOOTSTRAP_ADMIN_NAME || "Admin",
            password: e.BOOTSTRAP_ADMIN_PASSWORD,
            orgName: e.BOOTSTRAP_ORG_NAME || "My Organization",
          }
        : undefined,
  };
}
