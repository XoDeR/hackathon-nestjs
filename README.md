# Hackathon Backend

A NestJS 12 REST API for running hackathons: admins publish hackathons,
anyone can browse them, and authenticated users can join the active ones.

## Stack

| Concern | Choice |
| --- | --- |
| Framework | NestJS 12 (Express adapter), ESM, TypeScript |
| Runtime | Node.js 24+ |
| Database | PostgreSQL via Prisma 7 (`@prisma/adapter-pg`) |
| Auth | [Better Auth](https://better-auth.com) via `@thallesp/nestjs-better-auth` (email + password) |
| Abuse protection | [Arcjet](https://arcjet.com) — shield + rate limiting (global guard) |
| Tests | Vitest (unit + e2e) |
| Lint / format | oxlint + Prettier |

## Architecture

- **Infrastructure modules** live in `src/lib/` — each integration gets its
  own `@Global()` module + service, imported once in `AppModule`:
  - `lib/database` — `PrismaService` (connection lifecycle)
  - `lib/auth` — Better Auth wiring; its guard is registered globally
  - `lib/arcjet` — `ArcjetService` + `ArcjetGuard`
- **Feature modules** live in `src/module/<name>/` (`users`, `hackathons`).
- **Cross-cutting code** lives in `src/common/`:
  - `TransformInterceptor` — wraps every response as
    `{ statusCode, message, data }`; `@ResponseMessage('...')` overrides the message
  - `RolesGuard` + `@Roles()` — legacy custom role check (still used by `users`)
  - `ArcjetGuard` — global; runs on every request
- The Prisma client is generated into `src/generated/prisma/` (committed).

## Getting started

### 1. Prerequisites

- Node.js 24+
- A PostgreSQL database
- An Arcjet account (free) for an `ARCJET_KEY`

### 2. Install

```bash
npm install
```

### 3. Environment

Create a `.env` file (loaded via `process.loadEnvFile()` / `dotenv`):

```bash
# Server
PORT=3000

# Database
DATABASE_URL="postgresql://user:pass@host:5432/db"

# Arcjet
ARCJET_KEY="ajkey_xxx"
ARCJET_ENV="development"          # informational
ARCJET_MODE="DRY_RUN"            # DRY_RUN | LIVE
ARCJET_RATE_LIMIT_WINDOW="1m"
ARCJET_RATE_LIMIT_MAX="60"
```

The app throws on boot if `DATABASE_URL` or `ARCJET_KEY` is missing.

### 4. Database

```bash
npm run db:migrate      # apply migrations (prisma migrate dev)
npm run db:generate     # regenerate the Prisma client
npm run db:studio       # optional: open Prisma Studio
```

### 5. Run

```bash
npm run start:dev       # watch mode
npm run start           # one-off
npm run start:prod      # from dist/ (after npm run build)
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run start:dev` | Dev server, watch mode |
| `npm run build` | Compile to `dist/` |
| `npm test` / `npm run test:watch` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end tests |
| `npm run test:cov` | Coverage |
| `npm run lint` | oxlint |
| `npm run format` | Prettier write |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:generate` | `prisma generate` |
| `npm run db:format` | `prisma format` |
| `npm run db:studio` | Prisma Studio |

## API

All responses are wrapped: `{ "statusCode": number, "message": string, "data": T | null }`.

### Auth (`/api/auth/*`)

Handled by Better Auth (sign-up, sign-in, session, sign-out). These routes
bypass the Nest guard pipeline and have their own rate limit (60 / 60s).
New users get the `PARTICIPANT` role; `ADMIN` is assigned out of band.

### Users (`/users`)

| Method | Path | Access |
| --- | --- | --- |
| `GET` | `/users/me` | authenticated |
| `GET` | `/users/all` | `ADMIN` |
| `GET` | `/users/:id` | `ADMIN` |

### Hackathons (`/hackathons`)

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| `GET` | `/hackathons` | anyone | list, newest start first |
| `GET` | `/hackathons/:id` | anyone | includes author + participants |
| `POST` | `/hackathons` | `ADMIN` | body: `CreateHackathonDto` |
| `PATCH` | `/hackathons/:id` | `ADMIN` | body: `UpdateHackathonDto` (partial) |
| `DELETE` | `/hackathons/:id` | `ADMIN` | |
| `POST` | `/hackathons/:id/join` | authenticated | 403 if not active, 409 if already joined |

`CreateHackathonDto`:

| Field | Rules |
| --- | --- |
| `name` | string, min 3 |
| `description` | optional string, 10–1000 |
| `startsAt` | date (string coerced), must be in the future |
| `endsAt` | date, in the future and after `startsAt` |
| `isActive` | optional boolean (default `false`) |

Validation is enforced by a global `ValidationPipe` (`whitelist`,
`forbidNonWhitelisted`, `transform`). Failures return `400` with
`data` as an array of `{ property, message }`.

## Data model

- **User** — `id`, `name`, `email`, `role` (`PARTICIPANT` | `ADMIN`), … ;
  authors `Hackathon[]`, has `HackathonParticipant[]`.
- **Hackathon** — `name`, `description?`, `startDate`, `endDate`,
  `isActive`, `author` (User).
- **HackathonParticipant** — links a user to a hackathon with `joinedAt`;
  unique on `(hackathonId, userId)`.
- Better Auth tables: `Session`, `Account`, `Verification`.

## Notes

- Body parsing is disabled globally (`bodyParser: false`) and configured by
  the Better Auth module so it can read raw auth request bodies.
- `src/generated/prisma/` is committed — rerun `npm run db:generate` after
  changing `prisma/schema.prisma`.
- See `0003-background-jobs.md` for a plan to add Redis-backed background jobs.
