# 0001 — Stack

**Decision:** TypeScript (strict) monorepo with pnpm workspaces; Fastify + Drizzle + Postgres on the server; React + Vite on the web; Zod schemas shared by both; Vitest for tests; GitHub Actions builds a Docker image to GitHub's registry.

**Why:** the app is maintained by one person with AI assistance. Mainstream, strictly typed tools make mistakes fail the build instead of failing on event night. Postgres because more organizations are planned.

**Versions:** pinned exactly, on established major versions (TypeScript 5, Vite 7, ESLint 9) rather than the newest majors.
