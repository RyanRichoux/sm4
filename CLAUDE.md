# Smoker Matchmaker v4 — conventions for humans and AI assistants

Read this before changing anything. The requirements live in the "Smoker Matchmaker v4 — Requirements and Build Plan" doc; decisions with lasting consequences are in `docs/decisions/`.

## Layout

| Path | What | Depends on |
| --- | --- | --- |
| `packages/shared` | Zod schemas, types, roles and permissions shared by server and web | nothing |
| `packages/engine` | Pure matchmaking logic and the skill formula. No I/O, no database, no UI | `shared` |
| `apps/server` | Fastify API, Drizzle/Postgres, auth, audit log; serves the built web app | `shared`, `engine` |
| `apps/web` | React + Vite tablet-first web app | `shared` |

## Commands

```bash
pnpm install
pnpm dev                 # server :8080 + web :5173 (needs DATABASE_URL)
pnpm check               # lint, build, typecheck, test — run before every commit
pnpm db:generate         # after editing apps/server/src/db/schema.ts
pnpm seed                # demo organization and users (never in production)
```

Tests need Postgres: set `TEST_DATABASE_URL` (a user allowed to create databases).

## Rules

1. **TypeScript strict everywhere.** No `any`, no `@ts-ignore`. Use `unknown` and narrow.
2. **Validate at the boundary.** Every request body, query and param is parsed with a schema from `@sm/shared` before use.
3. **Every data query is scoped to an organization.** Org-owned tables have `org_id`; routes take `:orgId` and must pass `requirePermission(...)`, which checks membership. Never trust an id from the client without checking it belongs to the org.
4. **Permissions live in `packages/shared/src/permissions.ts`.** Check permissions, not role names, in code.
5. **Every change to data writes an audit entry** (`audit()` in `apps/server/src/audit.ts`), in the same transaction.
6. **Skill rating and emergency contacts never reach fighter-facing screens** (audience screen, fighter view, printouts). Public responses get their own schemas; tests assert the fields are absent.
7. **Migrations:** edit `schema.ts`, run `pnpm db:generate`, commit the generated SQL. Never edit a migration that has been applied anywhere.
8. **Small files.** Around 300 lines is the guide; split by feature.
9. **Tests are required** for every rule, permission and org-isolation path you add. Bug fix = failing test first.
10. **No secrets in code or logs.** Configuration comes from environment variables validated in `apps/server/src/config.ts`.
11. **Dependencies:** exact versions, at least two weeks old, mainstream only. Ask before adding one.

## Style

ESM with `.js` extensions on relative imports in Node packages. `import type` for types. Errors to users are plain, specific sentences.
