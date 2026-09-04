# Verify: Better Auth authentication · spec 0001 · updated 2026-09-04

_Steps derived from spec 0001 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [x] POST `/api/auth/sign-up/email` with a new email + 8+ char password → 200, session cookie set, response `user.role` is `"PARTICIPANT"` even if the request body includes `role: "ADMIN"` → AC-1
- [x] POST `/api/auth/sign-in/email` with correct credentials → 200, session cookie set → AC-2
- [x] POST `/api/auth/sign-in/email` with a wrong password → 401, body `{"code":"INVALID_EMAIL_OR_PASSWORD"}`, message does not name which field was wrong → AC-3
- [x] POST `/api/auth/sign-up/email` with an already-registered email → error response (currently Better Auth's default `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`; AC-4 relaxed to this default during the build, see `index.md` Build status note) → AC-4
- [x] POST `/api/auth/sign-out` (with `Origin` header set, e.g. `http://localhost:3000`) while signed in → 200, session cookie cleared; a subsequent request with the old cookie → 401 → AC-5
- [x] GET `/` (or any route with no `@AllowAnonymous`) with no session → 401 → AC-6
- [x] GET `/users/me` while signed in → 200, body has `id`, `email`, `name`, `role`, `emailVerified`, `image` → AC-7
- [x] GET `/users/me` with no session → 401 → AC-6
- [ ] A route decorated `@UseGuards(RolesGuard) @Roles(Role.ADMIN)`: a signed-in PARTICIPANT → 403 `"Insufficient role"`; a signed-in ADMIN → 200; unauthenticated → 401 (caught by the global auth guard first) → AC-8. _(Verified live during the build against a temporary test route, since no real admin route exists yet; re-verify against whichever real route first uses `@Roles`.)_
- [x] Run `npx tsx prisma/seed.ts` with `ADMIN_EMAILS` containing one existing user's email and one non-existent email → existing user's `role` becomes `ADMIN` in the DB; non-existent email is skipped and logged, no user is created → AC-9
- [x] Sign in again after the seed promotes a user → the new session reflects `role: "ADMIN"` (session is not stale-cached from before promotion) → AC-9
- [ ] Session lifetime: sign in, wait past `updateAge` (1 day) without a request, then make a request → session's `expiresAt` should extend from that request, not stay fixed to the original sign-in time → AC-10 _(not practical to verify in a single sitting; verify via the `Session.expiresAt` column shifting after an activity gap once real usage data exists)_
- [x] Flood `/api/auth/get-session` (60+ rapid requests) → 429 after the configured `rateLimit.max` (60/60s) is exceeded, since Arcjet's global guard does not cover Better Auth's mounted routes → AC-11
- [x] Flood a normal route, e.g. `/users/me` (60+ rapid requests) → 429 from the existing Arcjet guard, confirming it still covers the rest of the app → AC-11

## Commands

- [x] `npx nest build` → exits clean, no type errors
- [x] `npx prisma migrate status` → "Database schema is up to date!"
- [x] `node dist/main.js` → boots with no errors, `AuthModule initialized BetterAuth on '/api/auth'` and `Prisma connected` both log

## Acceptance-criteria coverage

- AC-1 … covered by the sign-up step (including the role-override attempt) · AC-2 … the sign-in step · AC-3 … the wrong-password step · AC-4 … the duplicate-email step (relaxed, see note) · AC-5 … the sign-out + reuse step · AC-6 … the two unauthenticated steps · AC-7 … the `/users/me` step · AC-8 … the RolesGuard step (needs re-verification against a real route) · AC-9 … the two seed steps · AC-10 … not practically verifiable pre-launch, flagged · AC-11 … the two flood steps
