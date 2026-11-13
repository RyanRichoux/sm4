import { ChangePasswordInput, LoginInput } from "@sm/shared";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { audit } from "../audit.js";
import { loadSessionUser, requireAuth } from "../auth/context.js";
import { LoginLimiter } from "../auth/login-limiter.js";
import { burnPasswordCheck, hashPassword, verifyPassword } from "../auth/passwords.js";
import { SESSION_COOKIE, createSession, deleteSessionById, revokeUserSessions } from "../auth/sessions.js";
import type { Config } from "../config.js";
import type { Db } from "../db/client.js";
import { users } from "../db/schema.js";
import { HttpError, parse } from "../errors.js";

export function authRoutes(app: FastifyInstance, { db, config }: { db: Db; config: Config }): void {
  const cookieOptions = { httpOnly: true, secure: config.cookieSecure, sameSite: "lax" as const, path: "/" };

  const limiter = new LoginLimiter(config.loginRateLimit);
  const tooMany = () => new HttpError(429, "Too many failed sign-in attempts. Wait 15 minutes and try again.", "rate_limited");

  app.post("/api/auth/login", async (req, reply) => {
      const input = parse(LoginInput, req.body);
      if (limiter.isBlocked(req.ip, input.email)) throw tooMany();
      const [user] = await db.select().from(users).where(eq(users.email, input.email));
      let ok = false;
      if (user) ok = await verifyPassword(user.passwordHash, input.password);
      else await burnPasswordCheck(input.password);
      if (!user || !ok) {
        limiter.recordFailure(req.ip, input.email);
        await audit(db, {
          orgId: null,
          actorUserId: user?.id ?? null,
          action: "auth.login_failed",
          entityType: "user",
          entityId: user?.id ?? null,
          after: { email: input.email },
          ip: req.ip,
        });
        throw new HttpError(401, "Email or password is incorrect.", "bad_credentials");
      }
      limiter.recordSuccess(req.ip, input.email);
      const sessionUser = await loadSessionUser(db, user.id);
      if (!sessionUser || sessionUser.memberships.length === 0) {
        throw new HttpError(403, "Your account doesn't have access to any organization. Ask an admin.", "no_access");
      }
      const token = await createSession(db, user.id, config.sessionDays, {
        ip: req.ip,
        userAgent: req.headers["user-agent"] ?? null,
      });
      await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
      await audit(db, { orgId: null, actorUserId: user.id, action: "auth.login", entityType: "user", entityId: user.id, ip: req.ip });
      reply.setCookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: config.sessionDays * 86_400 });
      return sessionUser;
  });

  app.post("/api/auth/logout", async (req, reply) => {
    if (req.auth) {
      await deleteSessionById(db, req.auth.sessionId);
      await audit(db, {
        orgId: null,
        actorUserId: req.auth.user.id,
        action: "auth.logout",
        entityType: "user",
        entityId: req.auth.user.id,
        ip: req.ip,
      });
    }
    reply.clearCookie(SESSION_COOKIE, cookieOptions);
    return { ok: true };
  });

  app.get("/api/auth/me", async (req) => requireAuth(req, { allowPasswordChange: true }).user);

  app.post("/api/auth/password", async (req) => {
    const auth = requireAuth(req, { allowPasswordChange: true });
    const input = parse(ChangePasswordInput, req.body);
    const [u] = await db.select().from(users).where(eq(users.id, auth.user.id));
    if (!u || !(await verifyPassword(u.passwordHash, input.currentPassword))) {
      throw new HttpError(400, "Your current password is incorrect.", "bad_password");
    }
    if (input.newPassword === input.currentPassword) {
      throw new HttpError(400, "Choose a password different from your current one.", "same_password");
    }
    const passwordHash = await hashPassword(input.newPassword);
    await db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash, mustChangePassword: false, updatedAt: new Date() }).where(eq(users.id, u.id));
      await revokeUserSessions(tx, u.id, auth.sessionId); // sign out other devices
      await audit(tx, { orgId: null, actorUserId: u.id, action: "auth.password_changed", entityType: "user", entityId: u.id, ip: req.ip });
    });
    return loadSessionUser(db, u.id);
  });
}
