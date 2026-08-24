---
name: Heyya demo auth
description: How session/auth works in Heyya — signed cookie, no auth library, demo login flow.
---

## Session mechanism

- `POST /api/users/demo-login` with `{ role }` finds the first user with that role and sets a signed cookie `userId`.
- Cookie is signed with `process.env.SESSION_SECRET ?? "heyya-dev-secret"`.
- All routes read the current user via `req.signedCookies?.userId` (falls back to `req.cookies?.userId`).
- `GET /api/users/me` returns 401 if no cookie → frontend redirects to login page.

**Why:** This is an intentional prototype/demo design — no Clerk, no Replit auth, no JWT. Keeps the first build simple and focused on the chat/school features.

**How to apply:** If adding real auth later, replace the cookie mechanism in `artifacts/api-server/src/routes/users.ts` (the `getCurrentUserId` helper function used in every route file) and add Clerk/Replit auth middleware to `artifacts/api-server/src/app.ts`.

## Demo users seeded

Roles: admin (Sarah Mitchell), teacher (James Okonkwo, Priya Sharma, Tom Henderson), student (5 users), parent (David Park, linked to Lily Chen via `child_id`).
