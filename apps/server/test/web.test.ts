import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setup } from "./helpers.js";
import type { TestCtx } from "./helpers.js";

let ctx: TestCtx;
beforeAll(async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "sm-web-"));
  writeFileSync(path.join(dir, "index.html"), "<!doctype html><title>Smoker Matchmaker</title>");
  mkdirSync(path.join(dir, "assets"));
  writeFileSync(path.join(dir, "assets", "app-abc123.js"), "console.log(1)");
  ctx = await setup({ WEB_DIST: dir });
});
afterAll(() => ctx.close());

describe("serving the web app", () => {
  it("returns the app shell for client-side routes, uncached", async () => {
    const r = await ctx.app.inject({ method: "GET", url: "/o/123/members" });
    expect(r.statusCode).toBe(200);
    expect(r.body).toContain("Smoker Matchmaker");
    expect(r.headers["cache-control"]).toBe("no-cache");
  });
  it("caches hashed assets for a year", async () => {
    const r = await ctx.app.inject({ method: "GET", url: "/assets/app-abc123.js" });
    expect(r.statusCode).toBe(200);
    expect(r.headers["cache-control"]).toContain("immutable");
  });
  it("answers unknown API paths with JSON 404, not the app shell", async () => {
    const r = await ctx.app.inject({ method: "GET", url: "/api/nothing-here" });
    expect(r.statusCode).toBe(404);
    expect(r.json().error).toBe("Not found.");
  });
  it("reports health", async () => {
    const r = await ctx.app.inject({ method: "GET", url: "/healthz" });
    expect(r.json()).toEqual({ ok: true });
  });
});
