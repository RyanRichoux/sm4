# Smoker Matchmaker v4

Matchmaking and event management for kickboxing smokers. This is the rebuild described in the "Smoker Matchmaker v4 — Requirements and Build Plan" doc.

**Status: Phase 0 (foundations).** Sign-in, organizations, members and roles, the audit log, CI, and deployment. Fighters, events, check-in and matchmaking arrive in Phase 1.

## Quick start (development)

Requires Node 22.12+, pnpm 9 (`npm i -g pnpm@9.15.9`) and Docker (or a local Postgres).

```bash
pnpm install
docker compose -f docker-compose.dev.yml up -d          # Postgres on 127.0.0.1:5432
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/matchmaker
export TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres
pnpm seed                                                # demo org and users
pnpm dev                                                 # http://localhost:5173
```

Demo sign-ins (password `demo-password-123`): `admin@demo.test`, `matchmaker@demo.test`, `checkin@demo.test`.

Before every commit: `pnpm check` (lint, build, typecheck, tests).

## Read next

- `CLAUDE.md`: conventions every contributor and AI assistant follows
- `docs/deploy.md`: home server, Tailscale, updates, backups
- `docs/decisions/`: why things are the way they are

## What Phase 0 includes

| Area | Details |
| --- | --- |
| Accounts | Argon2id passwords; server-side sessions in HttpOnly cookies; temporary passwords must be changed at first sign-in; changing a password signs out other devices |
| Abuse protection | Failed sign-ins limited per email and per IP (successes never count); same-site checks on every change; JSON-only request bodies; strict security headers |
| Organizations | Every member has roles per organization; people can belong to several; other organizations are invisible (404) |
| Roles | Admin, matchmaker, check-in staff, with permissions defined in `packages/shared` |
| Admin safeguards | You can't remove your own admin access; an organization always keeps one active admin; resetting a password needs admin rights in every organization the person belongs to |
| Audit log | Every change records who, when, before and after (secrets stripped), shown on the Activity page |
| Deployment | One Docker image built by GitHub Actions; Postgres; nightly backups kept 30 days; migrations run at startup |
| Tests | 40 automated tests against a real Postgres database |
