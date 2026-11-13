import { describe, expect, it } from "vitest";
import { AddMemberInput, LoginInput, ROLES, can, permissionsFor } from "./index.js";

describe("permissions", () => {
  it("only admins manage users and read the audit log", () => {
    expect(can(["admin"], "users.manage")).toBe(true);
    expect(can(["matchmaker"], "users.manage")).toBe(false);
    expect(can(["checkin"], "audit.read")).toBe(false);
  });
  it("check-in staff never see skill", () => {
    expect(can(["checkin"], "skill.read")).toBe(false);
    expect(can(["matchmaker"], "skill.read")).toBe(true);
  });
  it("check-in staff can handle contacts but not run events", () => {
    expect(can(["checkin"], "contacts.read")).toBe(true);
    expect(can(["checkin"], "events.run")).toBe(false);
  });
  it("roles combine", () => {
    expect(permissionsFor(["checkin", "matchmaker"])).toContain("events.run");
  });
  it("every role has at least read access to its organization", () => {
    for (const r of ROLES) expect(can([r], "org.read")).toBe(true);
  });
});

describe("schemas", () => {
  it("normalises email", () => {
    expect(LoginInput.parse({ email: "  Ryan@Example.COM ", password: "x" }).email).toBe("ryan@example.com");
  });
  it("rejects short passwords and empty roles with plain messages", () => {
    const r = AddMemberInput.safeParse({ email: "a@b.co", displayName: "A", password: "short", roles: [] });
    expect(r.success).toBe(false);
    const messages = r.success ? [] : r.error.issues.map((i) => i.message);
    expect(messages).toContain("Use at least 10 characters.");
    expect(messages).toContain("Pick at least one role.");
  });
  it("de-duplicates roles", () => {
    expect(AddMemberInput.parse({ email: "a@b.co", displayName: "A", roles: ["admin", "admin"] }).roles).toEqual(["admin"]);
  });
});
