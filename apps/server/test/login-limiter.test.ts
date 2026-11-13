import { describe, expect, it } from "vitest";
import { LoginLimiter } from "../src/auth/login-limiter.js";

describe("LoginLimiter", () => {
  it("blocks after the limit of failures, and the window expires", () => {
    const l = new LoginLimiter(3, 1000);
    for (let i = 0; i < 3; i++) l.recordFailure("1.1.1.1", "a@x", 0);
    expect(l.isBlocked("1.1.1.1", "a@x", 10)).toBe(true);
    expect(l.isBlocked("2.2.2.2", "a@x", 10)).toBe(false);
    expect(l.isBlocked("1.1.1.1", "a@x", 1001)).toBe(false);
  });
  it("a success clears the email's failures", () => {
    const l = new LoginLimiter(3, 1000);
    l.recordFailure("1.1.1.1", "a@x", 0);
    l.recordFailure("1.1.1.1", "a@x", 0);
    l.recordSuccess("1.1.1.1", "a@x");
    l.recordFailure("1.1.1.1", "a@x", 0);
    expect(l.isBlocked("1.1.1.1", "a@x", 1)).toBe(false);
  });
  it("caps failures per IP across many emails", () => {
    const l = new LoginLimiter(2, 1000, 4);
    for (let i = 0; i < 4; i++) l.recordFailure("1.1.1.1", `user${i}@x`, 0);
    expect(l.isBlocked("1.1.1.1", "fresh@x", 1)).toBe(true);
  });
});
