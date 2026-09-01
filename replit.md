# Quickquiz

Quickquiz is a secure live quiz platform for students, verified teachers, and moderators.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `PORT=18645 BASE_PATH=/ pnpm --filter @workspace/quiz-platform run dev` — run the quiz web app (port 18645; the configured Replit workflow supplies these automatically)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/quiz-platform` — responsive React/Vite application and role-aware routes.
- `artifacts/api-server` — Express API with server-side authorization and quiz/session flows.
- `lib/api-spec/openapi.yaml` — API source of truth; generated client hooks live in `lib/api-client-react`.
- `lib/db/src/schema/index.ts` — PostgreSQL schema for users, applications, keys, quizzes, and sessions.

## Architecture decisions

- Teacher accounts can only be created with a one-time registration key issued after moderator approval.
- Registration keys are returned only in the moderator approval response, stored as hashes, expire after 72 hours, and are marked used on successful registration.
- Moderator login requires `MODERATOR_EMAIL` and `MODERATOR_PASSWORD` server environment variables; no moderator signup route exists.
- Protected actions derive the role from an HTTP-only server cookie and enforce it in the API.

## Product

Students join without accounts and play live quizzes. Prospective teachers apply for review, then register only after approval. Teachers manage four-choice quizzes and host live sessions. Moderators review applications and suspend teacher accounts.

## User preferences

- Keep the product intentionally compact: no marketing, pricing, or public teacher/moderator signup surfaces.

## Gotchas

- Set `MODERATOR_EMAIL` and `MODERATOR_PASSWORD` as server-only environment variables before using the moderator login.
- After OpenAPI changes, run `pnpm --filter @workspace/api-spec run codegen`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
