# 0004 — Server-side sessions, not JWTs

**Decision:** login creates a random session token; the browser holds it in an HttpOnly, Secure, SameSite=Lax cookie; the database stores only its SHA-256 hash with an expiry. Passwords use Argon2id. Unsafe requests must be JSON and, when the browser sends an Origin header, it must match the host (CSRF protection).

**Why:** sessions can be revoked instantly (password reset, removing someone from an organization), which JWTs can't do without extra machinery.
