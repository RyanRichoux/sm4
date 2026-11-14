import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("database configuration", () => {
  it("accepts separate PG variables, so any password characters work", () => {
    const c = loadConfig({ PGHOST: "db", PGPASSWORD: "a/b+c=d@e:f" });
    expect(c.databaseUrl).toBeUndefined();
  });
  it("explains a broken DATABASE_URL instead of failing later", () => {
    expect(() => loadConfig({ DATABASE_URL: "postgres://u:pa/ss+w=rd@db:5432/x" })).toThrow(/URL-encode|PGHOST/);
  });
  it("requires one way or the other", () => {
    expect(() => loadConfig({})).toThrow(/set DATABASE_URL, or PGHOST/);
  });
  it("accepts a valid URL", () => {
    expect(loadConfig({ DATABASE_URL: "postgres://u:p@db:5432/x" }).databaseUrl).toBe("postgres://u:p@db:5432/x");
  });
});
