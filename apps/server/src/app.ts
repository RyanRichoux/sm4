import cookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import { sql } from "drizzle-orm";
import Fastify from "fastify";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { existsSync } from "node:fs";
import path from "node:path";
import { loadSessionUser } from "./auth/context.js";
import { SESSION_COOKIE, findSession } from "./auth/sessions.js";
import type { Config } from "./config.js";
import type { Db } from "./db/client.js";
import { HttpError } from "./errors.js";
import { authRoutes } from "./routes/auth.js";
import { memberRoutes } from "./routes/members.js";
import { orgRoutes } from "./routes/org.js";

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

/** CSRF: when a browser says where a change request comes from, it must be this site. */
function checkOrigin(req: FastifyRequest, config: Config): void {
  const origin = req.headers.origin;
  if (!origin || config.allowedOrigins.includes(origin)) return;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new HttpError(403, "Cross-site request blocked.", "csrf");
  }
  // Compare like-for-like: browsers drop default ports (":443", ":80") from Origin.
  const scheme = origin.startsWith("https:") ? "https:" : "http:";
  const normalise = (h: string | undefined) => {
    if (!h) return undefined;
    try {
      return new URL(`${scheme}//${h}`).host;
    } catch {
      return undefined;
    }
  };
  const fwd = req.headers["x-forwarded-host"];
  const hosts = [req.headers.host, config.trustProxy ? (Array.isArray(fwd) ? fwd[0] : fwd) : undefined].map(normalise);
  if (!hosts.includes(originHost)) throw new HttpError(403, "Cross-site request blocked.", "csrf");
}

export async function buildApp(config: Config, db: Db): Promise<FastifyInstance> {
  const app = Fastify({
    logger: config.nodeEnv === "test" ? false : { level: "info", redact: ["req.headers.cookie", "req.headers.authorization"] },
    trustProxy: config.trustProxy,
    bodyLimit: 1_000_000,
  });

  await app.register(cookie);

  app.decorateRequest("auth", null);
  app.addHook("onRequest", async (req) => {
    req.auth = null;
    if (!req.url.startsWith("/api/")) return;
    if (UNSAFE.has(req.method)) checkOrigin(req, config);
    const token = req.cookies[SESSION_COOKIE];
    if (!token) return;
    const session = await findSession(db, token);
    if (!session) return;
    const user = await loadSessionUser(db, session.userId);
    if (user) req.auth = { sessionId: session.id, user };
  });

  app.addHook("onSend", async (req, reply, payload) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "same-origin");
    reply.header("Content-Security-Policy", CSP);
    if (req.url.startsWith("/api/")) reply.header("Cache-Control", "no-store");
    return payload;
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof HttpError) {
      return reply.status(err.status).send({ error: err.message, code: err.code, issues: err.issues });
    }
    // Errors from Fastify itself (bad JSON, wrong content type, body too large) carry a statusCode.
    const e = (err ?? {}) as { statusCode?: unknown; message?: unknown; code?: unknown };
    const status = typeof e.statusCode === "number" ? e.statusCode : 500;
    if (status >= 500) {
      req.log.error(err);
      return reply.status(500).send({ error: "Something went wrong on the server." });
    }
    const message =
      status === 415
        ? "Send the request as JSON."
        : status === 413
          ? "The request is too large."
          : typeof e.message === "string"
            ? e.message
            : "Request failed.";
    return reply.status(status).send({ error: message, code: typeof e.code === "string" ? e.code : undefined });
  });

  app.get("/healthz", async (_req, reply) => {
    try {
      await db.execute(sql`select 1`);
      return { ok: true };
    } catch {
      return reply.status(503).send({ ok: false });
    }
  });

  authRoutes(app, { db, config });
  orgRoutes(app, { db });
  memberRoutes(app, { db });

  const webRoot = config.webDist ? path.resolve(config.webDist) : undefined;
  const hasWeb = !!webRoot && existsSync(path.join(webRoot, "index.html"));
  if (webRoot && hasWeb) {
    await app.register(fastifyStatic, {
      root: webRoot,
      cacheControl: false, // we set Cache-Control ourselves below
      setHeaders: (res, filePath) => {
        const hashed = filePath.includes(`${path.sep}assets${path.sep}`);
        res.setHeader("Cache-Control", hashed ? "public, max-age=31536000, immutable" : "no-cache");
      },
    });
  }
  app.setNotFoundHandler((req, reply) => {
    if (!hasWeb || req.method !== "GET" || req.url.startsWith("/api/")) {
      return reply.status(404).send({ error: "Not found.", code: "not_found" });
    }
    // Client-side routes: hand back the app shell.
    return reply.header("Cache-Control", "no-cache").sendFile("index.html");
  });

  return app;
}
