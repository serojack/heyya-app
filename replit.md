# Heyya

A chat-first school management app. Think Telegram, but for schools — every admin action (attendance, leave requests, timetables) happens through group chat rooms, never through forms.

## Run & Operate

- `pnpm --filter @workspace/heyya run dev` — run the frontend (port auto-assigned)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run validate:api-client` — regenerate the API client, then run the full workspace typecheck (use before committing OpenAPI or generated-client changes)
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — cookie signing secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS (Heyya artifact at `/`)
- API: Express 5 (api-server artifact at `/api`)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (v3 with v4 compat via `zod/v4`), `drizzle-zod`
- API codegen: Orval v8 (from OpenAPI spec at `lib/api-spec/openapi.yaml`)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/db/src/schema/` — Drizzle table definitions (users, rooms, room_members, messages, attendance_records, leave_requests)
- `artifacts/api-server/src/routes/` — Express route handlers (users, rooms, messages, attendance, leave)
- `artifacts/heyya/src/` — React frontend (Telegram-style 3-panel layout)
- `lib/api-client-react/src/generated/` — generated React Query hooks (do not edit)
- `lib/api-zod/src/generated/` — generated Zod validation schemas (do not edit)

## Architecture decisions

- **No forms, ever**: All user interactions happen in chat. Attendance and leave are triggered by slash commands or natural language messages that render as interactive card bubbles.
- **Demo login via signed cookie**: `POST /api/users/demo-login` sets a signed `userId` cookie. No auth library — this is intentional for the demo/prototype phase.
- **Orval codegen quirk**: `lib/api-spec/package.json` codegen script includes a `sed` command to strip `export * from './generated/types'` from the generated barrel, preventing TS2308 collision between Zod schema exports and TypeScript type exports. Do not remove this.
- **Integer types**: Use `type: number` (not `type: integer`) in `openapi.yaml` — Orval v8.23 generates `zod.int()` for `integer`, which doesn't exist in Zod v3. After codegen rerun, verify with `pnpm run typecheck:libs`.
- **JSONB for arrays**: `messages.reactions` and `attendance_records.entries` are stored as JSONB columns for flexible schema-on-write.

## Product

- **Rooms**: Class rooms, Staff rooms, Admin rooms — each a group chat
- **Messages**: text, system, attendance_card, leave_card, ai_message, file types
- **Attendance**: Teacher types `/takeattendance` → card appears → tap to mark exceptions → finalize
- **Leave requests**: Natural language → leave card in chat → admin approves/rejects
- **Roles**: admin, teacher, student, parent (each sees different UI and data)

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Demo users (seeded)

| Name | Email | Role |
|------|-------|------|
| Sarah Mitchell | sarah.admin@school.edu | admin |
| James Okonkwo | james.teacher@school.edu | teacher |
| Priya Sharma | priya.teacher@school.edu | teacher |
| Lily Chen | lily.student@school.edu | student |
| David Park | david.parent@school.edu | parent (linked to Lily) |

## Gotchas

- After `openapi.yaml` changes, always run `pnpm --filter @workspace/api-spec run codegen`, then `pnpm run typecheck:libs` — the sed post-processor removes the types barrel export collision.
- Date-format fields from Orval-generated Zod schemas are `Date` objects (due to `useDates: true`). Convert with `.toISOString().slice(0, 10)` before inserting into `date(mode: "string")` Drizzle columns.
- API server uses signed cookies for session. `SESSION_SECRET` env var required in production.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
