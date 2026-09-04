# 0001. Adopt Better Auth for authentication (rationale)

## Context

The backend has no authentication yet. Every route is currently open. The app already runs NestJS 12 on the Express adapter, with Prisma (Postgres, via `@prisma/adapter-pg`) as the only database integration and Arcjet as a global request guard (shield plus a fixed window rate limit) registered as `APP_GUARD` in `AppModule`.

The team needs sign up, sign in, sign out, and session backed route protection, plus a simple two role model (`PARTICIPANT`, `ADMIN`) so future features can gate admin only behavior. There is no existing spec for auth or for the identity data model; this spec is the first one and settles both.

Forces at play: this is a hackathon project, so implementation speed matters, but the team also wants to own its user data directly in the Postgres database it already runs, rather than depend on a hosted auth vendor. `CLAUDE.md` requires every infrastructure integration to get its own module and service under `src/lib/`, marked `@Global()`, constructor injected, never instantiated with `new` directly. No mail service exists yet, so any auth flow that needs to send email (password reset, email verification) is out of reach until one is built.

## Options considered

### Option 1: A self hosted auth library, Better Auth

An open source, TypeScript first auth library you run inside your own backend and own database, via `better-auth` plus the community `@thallesp/nestjs-better-auth` NestJS integration. It uses your existing Postgres database (through a Prisma adapter) for users, sessions, and accounts.

**Pros**:
- Full data ownership, no external auth vendor or extra monthly cost
- A dedicated, actively maintained NestJS integration exists, with global route protection, decorators (`@Session`, `@AllowAnonymous`, `@OptionalAuth`), and a session model out of the box
- Reuses the Prisma/Postgres setup already in this project, no new database or infra component
- Plugin system covers future needs (social login, two factor, magic links) without re-architecting

**Cons**:
- The NestJS integration is community maintained, not an official Better Auth or NestJS package
- Its `AuthModule.forRoot()` only accepts a pre-built `auth` instance (confirmed: no `forRootAsync`/factory injection), so the Better Auth instance itself has to be constructed once outside normal per-request Nest DI, a narrow, documented exception to "always use constructor injection"
- Still a real dependency to keep current (security relevant upgrades matter for an auth library)

### Option 2: A hosted auth provider (e.g. Clerk, Auth0, Supabase Auth)

Authentication and user storage run on a third party's infrastructure; the backend verifies tokens the provider issues.

**Pros**:
- Fastest to stand up, offloads password storage and session security entirely
- Provider handles compliance heavy features (breach detection, MFA, SSO) if ever needed

**Cons**:
- User data lives outside this project's own Postgres database, contradicting the team's preference to own it directly
- Adds an external cost and a new operational dependency for a hackathon project with no budget conversation
- Every environment (dev, demo) needs provider side app/project configuration before anyone can sign in

### Option 3: Passport.js (NestJS's traditional auth toolkit)

NestJS's own docs favor Passport strategies (`passport-local`, `passport-jwt`) wired through Nest's `PassportModule`.

**Pros**:
- "Official" NestJS pattern, extensive Stack Overflow/tutorial coverage
- Full control over every line of the auth flow

**Cons**:
- No batteries included: password hashing, session/cookie handling, rate limiting for auth endpoints, and the whole data model have to be hand built and hand audited
- Directly reinventing authentication, a well known source of subtle security bugs (session fixation, timing attacks on password comparison, insecure cookie defaults) that a maintained library already solves

### Option 4: Roll your own (custom bcrypt + session/JWT implementation)

**Pros**:
- Total control, zero third party auth code

**Cons**:
- The riskiest option: every security relevant detail (hashing cost factor, session/token expiry, CSRF, cookie flags) becomes this team's problem to get right and keep right
- Slowest to build correctly, despite feeling fast to start

## Rationale

Option 1 is the only option that satisfies both load bearing forces at once: keeping user data inside the project's own Postgres database (ruling out Option 2), and not hand rolling password/session security (ruling out Options 3 and 4, and matching the "reinventing auth" failure pattern this spec deliberately avoids). Better Auth's Prisma adapter plugs directly into the database already wired in `src/lib/database/prisma.service.ts`, and `@thallesp/nestjs-better-auth` gives default deny route protection and session decorators without writing a guard from scratch.

The one real cost, that `auth.ts` must build the Better Auth instance once outside per-request DI because `AuthModule.forRoot()` takes a static object, is accepted as a narrow, explicitly documented exception: `PrismaService` is still obtained through Nest's DI container (not `new PrismaService()`), so only the library's own required construction step, not this project's service graph, sits outside the normal pattern. This was verified directly against the library's current README and Better Auth's own Express integration doc, not assumed.

A related timing question: Nest instantiates providers, including the factory that calls `createAuth(prisma)`, before it runs `onModuleInit` lifecycle hooks, so the Better Auth instance is built before `PrismaService.onModuleInit()`'s explicit `$connect()` completes. This is safe: Prisma clients connect lazily on the first query by default, and `prismaAdapter` only stores the client reference at construction time, it issues no query until an actual auth request arrives, by which point `onModuleInit` has long since run. If a future version of the adapter ever performed an eager query at construction time, this would need revisiting.

## Evidence: body parser scoping (verified, not assumed)

Better Auth's NestJS doc says to pass `bodyParser: false` to `NestFactory.create()`. Read alone this looks like it disables JSON parsing for the whole app, not just the auth routes. This was checked directly rather than guessed:

- `@thallesp/nestjs-better-auth` (current: v2.8.0, requires `better-auth` ≥1.5.0; current `better-auth`: v1.7.2) `AuthModule.forRoot({ auth, bodyParser: {...} })` re-registers `express.json()`/`urlencoded()` for every route except its own auth path, once you supply the `bodyParser` option. Confirmed against the current GitHub README.
- Better Auth's own Express integration doc shows the same pattern manually: mount the auth handler on its path before `express.json()`, since body parsers consume the request stream.
- The library's `forRoot()` only accepts a static, pre-built `auth` object; there is no `forRootAsync`/factory based registration (confirmed directly against the current README).

So `bodyParser: false` at `NestFactory.create()` is still required (a mechanical requirement of how Nest's Express adapter registers global middleware), but its effect is not actually global: `AuthModule.forRoot`'s own `bodyParser` option restores normal parsing everywhere else.

## References

**Project sources** (verifiable, in this repo):
- `CLAUDE.md`, the infrastructure module convention (own module + service under `src/lib/`, `@Global()`, constructor injection, never `new SomeService()`)
- `src/lib/database/prisma.service.ts` and `prisma.module.ts`, the existing Prisma integration this spec's adapter reuses
- `src/common/guards/arcjet.guard.ts` and `src/lib/arcjet/`, the existing global rate limiting this spec relies on instead of adding a second one
- `.claude/skills/better-auth-best-practices/`, the installed community skill consulted for this design

**Practices & standards**:
- Generic authentication error messages to prevent user enumeration (do not reveal whether a given email is registered)
- Default deny route protection (every route requires a session unless explicitly marked public)
- Sliding session expiration (session lifetime extends on activity, rather than a fixed hard expiry)

**Links** (web verified during this design conversation):
- Better Auth NestJS integration doc: https://better-auth.com/docs/integrations/nestjs
- Better Auth Express integration doc (confirms the body parser ordering pattern): https://better-auth.com/docs/integrations/express
- `@thallesp/nestjs-better-auth` README (confirms the `bodyParser` option and the lack of `forRootAsync`): https://github.com/ThallesP/nestjs-better-auth/blob/master/README.md
