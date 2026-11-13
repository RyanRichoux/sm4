import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sessions, users } from "../src/db/schema.js";
import { PW, client, login, makeOrg, setup } from "./helpers.js";
import type { TestCtx } from "./helpers.js";

let ctx: TestCtx;
let orgId: string;

beforeAll(async () => {
  ctx = await setup({ LOGIN_RATE_LIMIT: "5" });
  ({ orgId } = await makeOrg(ctx.db, "Org A", "admin@a.test"));
});
afterAll(() => ctx.close());

describe("sign-in", () => {
  it("signs in case-insensitively, sets a hardened cookie and returns memberships", async () => {
    const r = await ctx.app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "ADMIN@a.test", password: PW } });
    expect(r.statusCode).toBe(200);
    const cookie = String(r.headers["set-cookie"]);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(r.json().memberships).toEqual([{ orgId, orgName: "Org A", roles: ["admin"] }]);
  });

  it("gives the same answer for an unknown email and a wrong password", async () => {
    const anon = client(ctx.app);
    const a = await anon.req("POST", "/api/auth/login", { email: "nobody@a.test", password: "whatever-123" });
    const b = await anon.req("POST", "/api/auth/login", { email: "admin@a.test", password: "wrong-password" });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.json.error).toBe(b.json.error);
  });

  it("stores only an Argon2id password hash and a hashed session token", async () => {
    const c = await login(ctx.app, "admin@a.test");
    const token = decodeURIComponent(c.cookie.split("=")[1] ?? "");
    const [u] = await ctx.db.select().from(users).where(eq(users.email, "admin@a.test"));
    expect(u?.passwordHash.startsWith("$argon2id$")).toBe(true);
    const rows = await ctx.db.select().from(sessions).where(eq(sessions.id, token));
    expect(rows).toHaveLength(0);
  });

  it("requires a session, and logout ends it", async () => {
    expect((await client(ctx.app).req("GET", "/api/auth/me")).status).toBe(401);
    const c = await login(ctx.app, "admin@a.test");
    expect((await c.req("GET", "/api/auth/me")).status).toBe(200);
    expect((await c.req("POST", "/api/auth/logout")).status).toBe(200);
    expect((await c.req("GET", "/api/auth/me")).status).toBe(401);
  });

  it("rate-limits failed sign-ins per email, without counting successful ones", async () => {
    // Many successful sign-ins never lock anyone out
    for (let i = 0; i < 8; i++) await login(ctx.app, "admin@a.test");
    const anon = client(ctx.app);
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      statuses.push((await anon.req("POST", "/api/auth/login", { email: "victim@a.test", password: "nope-nope-nope" })).status);
    }
    expect(statuses.every((s) => s === 401)).toBe(true);
    const blocked = await anon.req("POST", "/api/auth/login", { email: "victim@a.test", password: "nope-nope-nope" });
    expect(blocked.status).toBe(429);
    expect(blocked.json.error).toMatch(/Too many failed sign-in attempts/);
    // another email from the same place still works
    expect((await anon.req("POST", "/api/auth/login", { email: "admin@a.test", password: PW })).status).toBe(200);
  });
});

describe("request protection", () => {
  it("blocks changes coming from another site", async () => {
    const c = await login(ctx.app, "admin@a.test");
    const evil = await c.req("PATCH", `/api/orgs/${orgId}`, { name: "Hacked" }, { origin: "https://evil.example" });
    expect(evil.status).toBe(403);
    expect(evil.json.code).toBe("csrf");
    const same = await c.req("PATCH", `/api/orgs/${orgId}`, { name: "Org A" }, { origin: "http://localhost:80" });
    expect(same.status).toBe(200);
  });

  it("accepts only JSON request bodies", async () => {
    const r = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: "email=a&password=b",
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    expect(r.statusCode).toBe(415);
    expect(r.json().error).toBe("Send the request as JSON.");
  });

  it("sends security headers and never caches API responses", async () => {
    const r = await client(ctx.app).req("GET", "/api/auth/me");
    expect(r.headers["x-frame-options"]).toBe("DENY");
    expect(r.headers["content-security-policy"]).toContain("default-src 'self'");
    expect(r.headers["cache-control"]).toBe("no-store");
  });
});

describe("password change", () => {
  it("rejects a wrong current password and signs out other devices on success", async () => {
    const phone = await login(ctx.app, "admin@a.test");
    const laptop = await login(ctx.app, "admin@a.test");
    const bad = await laptop.req("POST", "/api/auth/password", { currentPassword: "wrong-one", newPassword: "another-good-pass" });
    expect(bad.status).toBe(400);
    const ok = await laptop.req("POST", "/api/auth/password", { currentPassword: PW, newPassword: "another-good-pass" });
    expect(ok.status).toBe(200);
    expect((await phone.req("GET", "/api/auth/me")).status).toBe(401);
    expect((await laptop.req("GET", "/api/auth/me")).status).toBe(200);
    // put it back for other tests
    await laptop.req("POST", "/api/auth/password", { currentPassword: "another-good-pass", newPassword: PW });
  });
});
