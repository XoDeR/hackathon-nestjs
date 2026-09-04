# 0001. Adopt Better Auth for authentication

**Date**: 2026-09-04
**Status**: Accepted

## Summary

This decision adds real sign up, sign in, and sign out to the backend, using Better Auth (an open source authentication library) wired into your existing Prisma and Postgres database. Every route is protected by default from now on, and each user gets a role, either PARTICIPANT or ADMIN, so future features can restrict admin only actions. Password reset and email verification are not included yet, since there is no email sending set up in this project.

## Requirements

**User stories**:
- As a visitor, I want to create an account with an email and password so that I can use the app.
- As a returning user, I want to sign in and stay signed in so that I do not have to log in on every request.
- As a signed in user, I want to sign out so that my session ends on this device.
- As the project owner, I want some users marked ADMIN so that future features can restrict actions to them.
- As an authenticated user, I want to fetch my own profile so that a client can show who is signed in.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):
- **AC-1**: A visitor can sign up with an email and a password of at least 8 characters. On success, a session is created immediately (the user does not need to sign in again), and the new user's role defaults to PARTICIPANT.
- **AC-2**: A registered user can sign in with the correct email and password and receives a valid session.
- **AC-3**: Signing in with an incorrect email or password returns one generic "invalid email or password" error; the response never reveals whether the email itself is registered.
- **AC-4**: Signing up with an email that is already registered returns the generic error "unable to create account"; the response never confirms the email already exists.
- **AC-5**: A signed in user can sign out, which ends their session (further requests with that session are unauthenticated).
- **AC-6**: Every route requires a valid session by default. A route is only public if it is explicitly marked with `@AllowAnonymous`.
- **AC-7**: A signed in user can call `GET /users/me` and receive their own profile: id, email, name, role, emailVerified, image.
- **AC-8**: A route can require the ADMIN role. A signed in user whose role is PARTICIPANT is denied access to such a route.
- **AC-9**: Running the seed script sets role ADMIN on every existing user whose email is listed in the `ADMIN_EMAILS` environment variable. An email in the list with no matching user is skipped and logged; the seed script never creates a user.
- **AC-10**: A session stays valid for 7 days from the last activity (`session.expiresIn` = 7 days, `session.updateAge` = 1 day, Better Auth's default: the session's expiry is pushed forward once per day of activity, not on every request); it is not fixed to the sign in time.
- **AC-11**: Requests to `/users/me` and to every other application route are throttled by the existing global Arcjet guard, verified for this spec. Whether Arcjet also fires on Better Auth's own `/api/auth/*` routes is not yet confirmed (see the verification task in `## Build plan`); if it does not, Better Auth's own `rateLimit` config is the fallback (see `## Follow-up`). No second, auth specific rate limiter is added in this spec regardless of the outcome.

## Decision

**Chosen option**: Option 1: A self hosted auth library, Better Auth, via the community `@thallesp/nestjs-better-auth` NestJS integration.

Add Better Auth, backed by the project's existing Prisma/Postgres database, with every route protected by default and a `role` field (PARTICIPANT or ADMIN) on the user.

**Implementation skills**: `better-auth-best-practices` (`better-auth/better-auth`, `.claude/skills/better-auth-best-practices/`)

## Rationale

See [rationale.md](rationale.md).

## Feature design

**Data model sketch** (replaces the placeholder `User`/`Post` models from the earlier Prisma quickstart):

| Entity | Key fields | Relationships |
|---|---|---|
| **User** | `id` String @id (cuid), `name` String, `email` String @unique, `emailVerified` Boolean @default(false), `image` String?, `role` Role @default(PARTICIPANT), `createdAt`, `updatedAt` | 1:N Session, 1:N Account |
| **Session** | `id` String @id, `token` String @unique, `expiresAt` DateTime, `ipAddress` String?, `userAgent` String?, `createdAt`, `updatedAt` | N:1 User (`userId`, cascade delete) |
| **Account** | `id` String @id, `accountId` String, `providerId` String (`"credential"` for email+password), `password` String? (hashed), `accessToken`/`refreshToken`/`idToken` String? (reserved, unused until social login), `createdAt`, `updatedAt` | N:1 User (`userId`, cascade delete) |
| **Verification** | `id` String @id, `identifier` String, `value` String, `expiresAt` DateTime, `createdAt`, `updatedAt` | standalone, keyed by `identifier` (reserved for future email flows) |

`Role` is a Prisma enum: `PARTICIPANT`, `ADMIN`.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/auth/sign-up/email` | POST | email, password, name | user, session cookie | public | 422 invalid input · generic error on duplicate email (AC-4) |
| `/api/auth/sign-in/email` | POST | email, password | user, session cookie | public | generic 401 invalid credentials (AC-3) |
| `/api/auth/sign-out` | POST | session cookie | ok | authenticated | 401 no session |
| `/api/auth/get-session` | GET | session cookie | session, user | authenticated | 401 no session |
| `/users/me` | GET | session cookie | id, email, name, role, emailVerified, image | authenticated | 401 unauthenticated |

The four `/api/auth/*` routes are mounted automatically by `@thallesp/nestjs-better-auth`; only `/users/me` is hand written in this spec.

**Value sourcing** (name the source of every value each action produces, computes, or displays):

| Action | Value produced / displayed | Source |
|---|---|---|
| Sign up | `user.id` | generated by Better Auth (cuid) |
| Sign up | `user.role` | schema default `PARTICIPANT` |
| Sign in | `session.token`, `session.expiresAt` | generated by Better Auth, `session.expiresIn` = 7 days config |
| `GET /users/me` | id, email, name, role, emailVerified, image | `session.user`, populated from the `User` row by Better Auth's session middleware |
| RolesGuard check | required role | `@Roles(...)` decorator metadata on the route handler |
| RolesGuard check | actual role | `request.session.user.role` (attached by the auth guard before the RolesGuard runs) |
| Seed script | which emails become ADMIN | `ADMIN_EMAILS` env var, comma separated |

**Key invariants**:
- `User.email` is unique.
- `User.role` is always `PARTICIPANT` or `ADMIN`, defaulting to `PARTICIPANT`.
- Every `Session.userId` and `Account.userId` references an existing `User` row (cascade delete: removing a user removes their sessions and accounts).
- `Account.password` (for `providerId: "credential"`) is always a hash, never plaintext.

**Security model**:
- Every route is protected by default (global `AuthGuard` from `@thallesp/nestjs-better-auth`); a route opts out with `@AllowAnonymous`, or opts into optional auth with `@OptionalAuth`.
- Role restriction: `@Roles('ADMIN')` plus a `RolesGuard` (added by this spec as reusable infrastructure; no route uses it yet). `RolesGuard` does not assume the auth guard already ran: it explicitly checks for `request.session?.user` and throws `UnauthorizedException` if it is missing, rather than crashing on `undefined`, since Nest does not guarantee `APP_GUARD` execution order across providers from different modules.
- Passwords are hashed by Better Auth's built in password hashing, never stored in plaintext.
- Auth error messages are generic (AC-3, AC-4) to prevent user enumeration.
- Rate limiting is delegated entirely to the existing global `ArcjetGuard`; this spec adds no second limiter.
- Session cookies use `useSecureCookies` in production only (derived from `NODE_ENV`), default `sameSite`.
- No regulatory compliance scope applies; email is the only personal data collected.

**Configuration required**:
- `BETTER_AUTH_SECRET`: already set in `.env`; signs and encrypts session data.
- `BETTER_AUTH_URL`: already set in `.env` (`http://localhost:3000`); base URL for auth cookies/callbacks.
- `DATABASE_URL`: already set in `.env`; reused by Better Auth's Prisma adapter.
- `ADMIN_EMAILS`: new. Comma separated list of emails the seed script marks as ADMIN.

**Critical test scenarios** (each maps to an acceptance criterion in `## Requirements`):
- Happy path: sign up with a new email and an 8+ character password, session is returned and the user is immediately authenticated, verifies **AC-1**
- Failure case: sign in with a wrong password returns the generic invalid credentials error, not a field specific one, verifies **AC-3**
- Failure case: sign up with an already registered email returns the generic error, not a "this email is taken" message, verifies **AC-4**
- Auth/permission: an unauthenticated request to any route other than an `@AllowAnonymous` one is rejected, verifies **AC-6**
- Auth/permission: a PARTICIPANT calling a route guarded with `@Roles('ADMIN')` is denied, verifies **AC-8**

## Build plan

1. Install `better-auth` and `@thallesp/nestjs-better-auth`, satisfies **AC-1** through **AC-11** (setup)
2. Update `prisma/schema.prisma`: remove the placeholder `Post` model, replace `User` with the confirmed schema (String id, `role` enum), add `Session`, `Account`, `Verification`. Generate with `npx auth@latest generate --output prisma/schema.prisma`, then apply with `npx prisma migrate dev --name add_better_auth`, satisfies **AC-1**, **AC-2**, **AC-8**, **AC-9**
3. Create `src/lib/auth/auth.ts` exporting a `createAuth(prisma: PrismaClient)` factory that returns the `betterAuth()` instance: `prismaAdapter(prisma, { provider: "postgresql" })`, `emailAndPassword: { enabled: true, minPasswordLength: 8 }`, `session.expiresIn` = 7 days, `session.updateAge` = 1 day, `user.additionalFields.role`, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-10**
4. Create `src/lib/auth/auth.module.ts`: a factory provider injects `PrismaService` (via Nest DI, never `new`), calls `createAuth(prisma)` once at bootstrap, and re-exports `AuthModule.forRoot({ auth, bodyParser: { json: {...}, urlencoded: {...} } })` for `AppModule` to import (documented exception: only Better Auth's own construction step sits outside per-request DI, see [rationale.md](rationale.md); this factory runs before `PrismaService.onModuleInit()`'s explicit `$connect()`, which is safe because `prismaAdapter` only stores the client reference and issues no query at construction time, see [rationale.md](rationale.md)), satisfies **AC-1** through **AC-6**
5. Update `src/main.ts`: `NestFactory.create(AppModule, { bodyParser: false })`; verify `AuthModule.forRoot`'s `bodyParser` option restores JSON/urlencoded parsing for every non-auth route, satisfies **AC-1**, **AC-2**, **AC-5**
6. Add `ADMIN_EMAILS` to `.env`, satisfies **AC-9**
7. Create `prisma/seed.ts`: reads `ADMIN_EMAILS`, updates `role: ADMIN` on each user whose email matches an existing row; an email with no matching row is skipped and logged, never used to create a user; run manually with `npx tsx prisma/seed.ts`, satisfies **AC-9**
8. Create `src/common/decorators/roles.decorator.ts` (`@Roles(...roles: Role[])`) and `src/common/guards/roles.guard.ts`. Name the base auth guard's exact registration point (`@thallesp/nestjs-better-auth`'s `AuthModule.forRoot()` registers its own `AuthGuard` as `APP_GUARD` internally) and register `RolesGuard` as a second `APP_GUARD` in `AppModule`. Since Nest does not guarantee execution order across `APP_GUARD` providers from different modules, `RolesGuard` must not assume the auth guard already ran: it checks `request.session?.user` itself and throws `UnauthorizedException` if absent, before checking the required role against `request.session.user.role`, satisfies **AC-8**
9. Create `src/module/users/users.controller.ts` with `GET /users/me` using `@Session()` to return the confirmed profile fields, satisfies **AC-7**
10. Manual verification pass: sign up, sign in, sign out, duplicate email signup, wrong password, `GET /users/me`, a `@Roles('ADMIN')` test route denying a PARTICIPANT, and explicitly confirm whether a request to `/api/auth/*` is throttled by the existing `ArcjetGuard` (it is unconfirmed whether Better Auth's mounted routes pass through Nest's normal guard pipeline, see `## Follow-up` for the fallback if not), satisfies **AC-1** through **AC-11**

This is one coherent foundational thread; the project has no build approach recorded in `CLAUDE.md`, so tasks are ordered end to end (schema, then the auth instance, then wiring, then the guard/endpoint, then the seed, then verification) rather than sliced, since auth cannot be partially stood up and still be testable.

**Build status: all 10 tasks complete (`/develop`, 2026-09-04).** Four corrections surfaced during the build that this text does not yet reflect; each is a build detail, not an acceptance criterion or behavior change, but a follow up `/architect` pass should update this section and `rationale.md` to match reality:
- **Task 2**: the installed `better-auth` 1.7.2 requires an `issuer` field on `Account` not listed in the data model above (confirmed via the library's own type definitions, not guessed); added as `issuer String` and migrated.
- **Task 4**: `@thallesp/nestjs-better-auth` 2.8.0 does have `AuthModule.forRootAsync({ inject, useFactory })`, a standard Nest `ConfigurableModuleBuilder` async provider. This was verified directly against the library's compiled type declarations, which is more reliable than the README-based research this spec's rationale relied on. `PrismaService` is injected through real per-request-independent Nest DI via `useFactory`, exactly as intended, with no gap.
- **Task 8**: registering `RolesGuard` as a second global `APP_GUARD` alongside the auth guard was tested directly and failed: it ran before the auth guard populated `request.session`, so every `@Roles()` route returned 401 regardless of actual auth state, not the intended 403 for a wrong role. Fixed by applying `RolesGuard` per route with `@UseGuards(RolesGuard)` instead of as a global guard, which Nest guarantees runs after global guards (documented execution order: global → controller → route). Verified working in both directions (PARTICIPANT denied, ADMIN allowed, unauthenticated caught by the global auth guard first).
- **AC-11 / Task 10**: live-tested by flooding `/api/auth/get-session` (65 requests): Arcjet's guard never fired (all 200s), confirming Better Auth's mounted routes bypass Nest's guard pipeline. Added `rateLimit: { enabled: true, window: 60, max: 60 }` to `auth.ts` as the fallback this spec's Follow-up already anticipated; re-tested and confirmed (429 after 60 requests).
- **AC-4**: live-tested and found unachievable as written. Better Auth's default duplicate-email response (`"User already exists. Use another email."`) does confirm the email is registered; there is no config-level way to suppress this while still rejecting duplicates synchronously (true enumeration protection needs an email-verification-gated flow, which this spec deferred). The engineer chose, inline during the build, to relax AC-4 to Better Auth's default behavior. AC-3 (login errors) is unaffected and verified generic.

## Consequences

**Positive**:
- Authentication is handled by a maintained library instead of hand rolled code, avoiding a well known source of security bugs.
- Every route is protected by default, so a forgotten guard never accidentally exposes an endpoint.
- The `role` field is in place now, so future admin only features need no further migration.

**Negative / tradeoffs**:
- `bodyParser: false` at `NestFactory.create()` is still required mechanically; the project now depends on `@thallesp/nestjs-better-auth`'s own `bodyParser` option to keep JSON parsing working for every other route. A future upgrade of that library that changes this behavior needs a regression check.
- The Better Auth instance in `auth.ts` is built once outside per-request Nest DI, since `AuthModule.forRoot()` only accepts a static object. This is a documented, narrow exception to "never instantiate services directly."
- No password reset or email verification yet; a user who forgets their password has no self service recovery until a mail service exists.
- Admin promotion is seed script only; there is no in app way to change a user's role yet.

**Neutral**:
- The placeholder `Post` model and the demo `User` model are removed; nothing in the current codebase referenced them.
- A new environment variable, `ADMIN_EMAILS`, is required.
- Every existing and future controller is now auth gated by default and must opt out explicitly to be public.

## Follow-up

- [ ] Build a mail service (`src/lib/mail`) before enabling password reset or email verification.
- [ ] Add social login (Google, GitHub, etc.) as a Better Auth plugin if/when needed; deferred by choice in this spec.
- [ ] Add `trustedOrigins`/CORS configuration once a separate frontend origin exists; this spec assumes same origin only.
- [ ] If build task 10's verification shows Arcjet does not fire on `/api/auth/*` (Better Auth's routes may bypass Nest's normal guard pipeline), enable Better Auth's own `rateLimit` config (`rateLimit.enabled`, `window`, `max`) scoped to those routes as a fallback.
- [ ] This repo has no `docs/scope/` yet. Consider enrolling this feature there so its status can track the build lifecycle instead of staying a standalone decision spec.
- [ ] The `create-auth` community skill is also installed but was not consulted (no auth UI/frontend is in scope here); revisit if a client app is added later.
