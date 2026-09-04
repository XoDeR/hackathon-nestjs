# Scope

**Workflow:** Alpha (default). Security relevant features get at least a Verify pass before being called done; adjust per feature with a tier tag if one clearly needs more or less.

## At a glance

| Feature | Status | Spec |
|---|---|---|
| Better Auth authentication | in-progress | [0001](../specs/0001-better-auth-integration/index.md) |

## Features

### Better Auth authentication

**Intent**: Add real sign up, sign in, sign out, and session backed route protection to the backend, with a PARTICIPANT/ADMIN role on every user, using Better Auth on the existing Prisma/Postgres database.

**Done when**: A visitor can sign up and sign in with email and password, every route is protected by default, `GET /users/me` returns the signed in profile, and an ADMIN only route correctly denies a PARTICIPANT.

- [x] Design it (spec): [0001](../specs/0001-better-auth-integration/index.md)
- [x] Build it: `/develop Better Auth authentication` — code in `src/lib/auth/`, `src/module/users/`, `src/common/decorators/roles.decorator.ts`, `src/common/guards/roles.guard.ts`, `prisma/schema.prisma`, `prisma/seed.ts`
  - [x] Data model and library wiring: replaced the placeholder User/Post schema with the Better Auth schema (User, Session, Account, Verification, role enum), installed and configured Better Auth + `@thallesp/nestjs-better-auth`, satisfies AC-1, AC-2, AC-8, AC-9, AC-10
  - [x] Sign up / sign in / sign out working end to end through the app; login errors are generic (AC-3), duplicate email signup is NOT generic (AC-4 relaxed, see spec follow-up), satisfies AC-1, AC-2, AC-3, AC-5
  - [x] Default deny route protection wired into `main.ts` and `AppModule`, satisfies AC-6
  - [x] Role guard, `GET /users/me`, and the admin seed script, satisfies AC-7, AC-8, AC-9
  - [x] Confirmed Arcjet does NOT throttle `/api/auth/*` (bypasses Nest's guard pipeline); added Better Auth's own `rateLimit` config as the fallback the spec anticipated, satisfies AC-11
- [ ] Verify it: `/check verify Better Auth authentication`
