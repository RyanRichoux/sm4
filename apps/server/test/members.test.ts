import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PW, login, makeOrg, setup } from "./helpers.js";
import type { Client, TestCtx } from "./helpers.js";

let ctx: TestCtx;
let orgA: string;
let orgB: string;
let adminA: Client;
let adminB: Client;
const TEMP = "temporary-pass-1";

async function addMember(by: Client, orgId: string, email: string, roles: string[], password: string | null = TEMP) {
  return by.req("POST", `/api/orgs/${orgId}/members`, { email, displayName: email.split("@")[0], roles, ...(password ? { password } : {}) });
}
async function activate(email: string): Promise<Client> {
  const c = await login(ctx.app, email, TEMP);
  const r = await c.req("POST", "/api/auth/password", { currentPassword: TEMP, newPassword: PW });
  expect(r.status).toBe(200);
  return c;
}

beforeAll(async () => {
  ctx = await setup();
  ({ orgId: orgA } = await makeOrg(ctx.db, "Org A", "admin@a.test"));
  ({ orgId: orgB } = await makeOrg(ctx.db, "Org B", "admin@b.test"));
  adminA = await login(ctx.app, "admin@a.test");
  adminB = await login(ctx.app, "admin@b.test");
});
afterAll(() => ctx.close());

describe("adding members", () => {
  it("creates an account that must change its password before doing anything", async () => {
    const r = await addMember(adminA, orgA, "mm@a.test", ["matchmaker"]);
    expect(r.status).toBe(201);
    expect(r.json).toMatchObject({ email: "mm@a.test", roles: ["matchmaker"], active: true, mustChangePassword: true });
    const mm = await login(ctx.app, "mm@a.test", TEMP);
    const blocked = await mm.req("GET", `/api/orgs/${orgA}`);
    expect(blocked.status).toBe(403);
    expect(blocked.json.code).toBe("password_change_required");
    await mm.req("POST", "/api/auth/password", { currentPassword: TEMP, newPassword: PW });
    const ok = await mm.req("GET", `/api/orgs/${orgA}`);
    expect(ok.status).toBe(200);
    expect(ok.json.permissions).toContain("events.run");
    expect(ok.json.permissions).not.toContain("users.manage");
  });

  it("explains validation problems in plain words", async () => {
    const r = await adminA.req("POST", `/api/orgs/${orgA}/members`, { email: "not-an-email", displayName: "X", roles: ["admin"], password: TEMP });
    expect(r.status).toBe(400);
    expect(r.json.error).toBe("Enter a valid email address.");
    const noPw = await addMember(adminA, orgA, "new@a.test", ["checkin"], null);
    expect(noPw.json.error).toMatch(/starting password/);
  });

  it("refuses duplicates and keeps an existing account's password when it joins a second organization", async () => {
    expect((await addMember(adminA, orgA, "mm@a.test", ["matchmaker"])).status).toBe(409);
    const r = await addMember(adminB, orgB, "mm@a.test", ["checkin"], null);
    expect(r.status).toBe(201);
    const mm = await login(ctx.app, "mm@a.test", PW);
    const me = await mm.req("GET", "/api/auth/me");
    expect(me.json.memberships.map((m: { orgName: string }) => m.orgName)).toEqual(["Org A", "Org B"]);
  });
});

describe("permissions and isolation", () => {
  it("only admins manage members or read the audit log", async () => {
    await addMember(adminA, orgA, "ci@a.test", ["checkin"]);
    const ci = await activate("ci@a.test");
    const mm = await login(ctx.app, "mm@a.test", PW);
    for (const c of [ci, mm]) {
      expect((await c.req("GET", `/api/orgs/${orgA}/members`)).status).toBe(403);
      expect((await c.req("GET", `/api/orgs/${orgA}/audit`)).status).toBe(403);
      expect((await c.req("PATCH", `/api/orgs/${orgA}`, { name: "x" })).status).toBe(403);
    }
  });

  it("hides one organization from another's admin entirely", async () => {
    for (const url of [`/api/orgs/${orgA}`, `/api/orgs/${orgA}/members`, `/api/orgs/${orgA}/audit`]) {
      expect((await adminB.req("GET", url)).status).toBe(404);
    }
    const members = await adminA.req("GET", `/api/orgs/${orgA}/members`);
    const target = members.json.find((m: { email: string }) => m.email === "ci@a.test");
    expect((await adminB.req("PATCH", `/api/orgs/${orgA}/members/${target.userId}`, { active: false })).status).toBe(404);
    expect((await adminB.req("PATCH", `/api/orgs/${orgB}/members/${target.userId}`, { active: false })).status).toBe(404);
  });

  it("rejects malformed ids", async () => {
    expect((await adminA.req("GET", "/api/orgs/not-a-uuid")).status).toBe(400);
  });
});

describe("protecting access", () => {
  it("won't let an admin remove their own admin access or the last admin", async () => {
    const me = (await adminA.req("GET", "/api/auth/me")).json;
    const self = await adminA.req("PATCH", `/api/orgs/${orgA}/members/${me.id}`, { roles: ["matchmaker"] });
    expect(self.json.code).toBe("self_lockout");
    await addMember(adminA, orgA, "admin2@a.test", ["admin"]);
    const admin2 = await activate("admin2@a.test");
    const demoteOther = await admin2.req("PATCH", `/api/orgs/${orgA}/members/${me.id}`, { roles: ["checkin"] });
    expect(demoteOther.status).toBe(200);
    const list = (await admin2.req("GET", `/api/orgs/${orgA}/members`)).json;
    const a2 = list.find((m: { email: string }) => m.email === "admin2@a.test");
    // admin2 is now the only admin; nobody can remove that, including themselves
    expect((await admin2.req("PATCH", `/api/orgs/${orgA}/members/${a2.userId}`, { active: false })).json.code).toBe("self_lockout");
    // restore
    expect((await admin2.req("PATCH", `/api/orgs/${orgA}/members/${me.id}`, { roles: ["admin"] })).status).toBe(200);
  });

  it("deactivating a member signs them out and removes access", async () => {
    await addMember(adminA, orgA, "gone@a.test", ["checkin"]);
    const gone = await activate("gone@a.test");
    const list = (await adminA.req("GET", `/api/orgs/${orgA}/members`)).json;
    const g = list.find((m: { email: string }) => m.email === "gone@a.test");
    expect((await adminA.req("PATCH", `/api/orgs/${orgA}/members/${g.userId}`, { active: false })).status).toBe(200);
    expect((await gone.req("GET", "/api/auth/me")).status).toBe(401);
    const again = await ctx.app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "gone@a.test", password: PW } });
    expect(again.statusCode).toBe(403);
  });

  it("resetting a password signs the person out and forces a new one", async () => {
    await addMember(adminA, orgA, "forgot@a.test", ["checkin"]);
    const f = await activate("forgot@a.test");
    const id = (await f.req("GET", "/api/auth/me")).json.id;
    expect((await adminA.req("POST", `/api/orgs/${orgA}/members/${id}/reset-password`, { newPassword: TEMP })).status).toBe(200);
    expect((await f.req("GET", "/api/auth/me")).status).toBe(401);
    const back = await login(ctx.app, "forgot@a.test", TEMP);
    expect((await back.req("GET", "/api/auth/me")).json.mustChangePassword).toBe(true);
  });

  it("won't reset the password of someone who also belongs to an organization you don't administer", async () => {
    const mmId = (await (await login(ctx.app, "mm@a.test", PW)).req("GET", "/api/auth/me")).json.id;
    const r = await adminA.req("POST", `/api/orgs/${orgA}/members/${mmId}/reset-password`, { newPassword: TEMP });
    expect(r.status).toBe(403);
  });
});

describe("audit log", () => {
  it("records changes with the actor, newest first, without secrets, and pages", async () => {
    const page = await adminA.req("GET", `/api/orgs/${orgA}/audit?limit=3`);
    expect(page.status).toBe(200);
    expect(page.json).toHaveLength(3);
    expect(page.json[0].id).toBeGreaterThan(page.json[1].id);
    const all = (await adminA.req("GET", `/api/orgs/${orgA}/audit?limit=200`)).json;
    const actions = all.map((e: { action: string }) => e.action);
    expect(actions).toEqual(expect.arrayContaining(["org.created", "member.added", "member.updated", "member.password_reset"]));
    expect(JSON.stringify(all)).not.toMatch(/passwordHash|temporary-pass|argon2/);
    expect(all.find((e: { action: string }) => e.action === "member.added").actorName).toBe("Org A Admin");
    const next = (await adminA.req("GET", `/api/orgs/${orgA}/audit?limit=3&before=${page.json[2].id}`)).json;
    expect(next[0].id).toBeLessThan(page.json[2].id);
    // Org B's log doesn't contain Org A's events
    const b = (await adminB.req("GET", `/api/orgs/${orgB}/audit?limit=200`)).json;
    expect(b.every((e: { action: string; after: { email?: string } | null }) => e.after?.email !== "ci@a.test")).toBe(true);
  });
});
