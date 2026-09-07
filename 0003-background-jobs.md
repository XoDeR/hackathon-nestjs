# Background Jobs with Retries (Redis / BullMQ)

Outline only — no implementation. Describes how to add durable, retrying
background jobs to this NestJS 12 + Express backend, following the
project's "every integration gets its own module + service, mark it
`@Global()`, inject don't instantiate" conventions.

## 1. Choose the stack

- **Queue library:** BullMQ via the official `@nestjs/bullmq` package
  (Nest-first wrapper: `BullModule`, `@Processor`, `@Prisma`-style DI).
  Preferred over the legacy `bull` / `@nestjs/bull`.
- **Broker:** Redis (BullMQ requires it). Use a managed Redis in prod
  (Upstash, Redis Cloud, AWS ElastiCache); local Redis via Docker for dev.
- **Why a queue and not `setTimeout` / in-process:** survives restarts and
  crashes, retries with backoff, concurrency control, scheduling, and
  observability — none of which an in-process approach gives you.

## 2. Packages to add

- `@nestjs/bullmq`, `bullmq` — queue + processors
- `ioredis` — connection (BullMQ's peer dep)
- Optional dev/ops:
  - `@bull-board/api` + `@bull-board/express` — web dashboard for queues
  - `@nestjs/config` if Redis settings should come from validated config
    (currently the project reads `process.env` directly — match whichever
    pattern is in place)

## 3. Environment / config

- Add `REDIS_URL` (or discrete `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD`
  / `REDIS_TLS`) to `.env` and the deployment secrets.
- Document them in the README / env example.
- Fail fast on boot if the queue is enabled and `REDIS_URL` is missing
  (same guard style as `PrismaService`'s `DATABASE_URL` check).

## 4. Module layout (follow project conventions)

```
src/lib/queue/
  queue.module.ts        # @Global() — registers BullModule.forRoot + shared connection
  queue.constants.ts     # queue name constants, job name enums, typed payloads
```

- `queue.module.ts`
  - Calls `BullModule.forRootAsync(...)` once with the Redis connection
    (host/port/password/tls, `maxRetriesPerRequest: null` for BullMQ).
  - Sets **default job options** in one place: `attempts`, `backoff`
    (exponential, e.g. base 2–5 s), `removeOnComplete` (keep last N or an
    age), `removeOnFail` (keep more, for debugging).
  - Marked `@Global()`, imported once in `AppModule`, exports nothing extra
    beyond what `BullModule` re-exports.
- Per-feature queues are registered in the **feature module**, not here:
  `BullModule.registerQueue({ name: QUEUE.EMAIL })` inside
  `src/module/<feature>/<feature>.module.ts`.

## 5. Per-feature job code

For a feature that needs background work (example: sending hackathon
notification emails), inside `src/module/<feature>/`:

- `<feature>.queue.ts` — thin injectable service wrapping the `Queue`
  (`@InjectQueue(QUEUE.X)`); exposes typed `enqueueXxx(payload, opts?)`
  methods so callers never touch BullMQ directly (mirrors the
  "never instantiate, always inject" rule).
- `<feature>.processor.ts` — `@Processor(QUEUE.X)` class extending
  `WorkerHost`; `process(job)` switches on `job.name`, does the work by
  delegating to existing services (e.g. `MailService`, `PrismaService`).
  Keep it a coordinator — no business logic that isn't already in a service.
- The feature module registers the queue, and lists the processor + queue
  service in `providers`.

## 6. Retry & failure strategy

- **Retries:** set `attempts` (e.g. 3–5) + exponential `backoff` in the
  default job options; override per-job for expensive/external calls.
- **Idempotency:** processors must be safe to run twice (dedupe on a job
  key, upsert instead of insert, check "already sent" state). BullMQ
  guarantees at-least-once, not exactly-once.
- **Non-retryable errors:** throw `UnrecoverableError` from `bullmq` to
  stop further attempts (e.g. validation failure, 4xx from a provider).
- **Dead-letter handling:** jobs that exhaust attempts stay in the
  `failed` set (because of `removeOnFail` retention). Options:
  - inspect via Bull Board,
  - a scheduled sweep (see §8) that alerts / logs / moves them,
  - a manual "retry failed" admin action.
- **Poison-message protection:** cap `removeOnFail` age/count so the set
  can't grow unbounded.
- **Observability:** listen to worker events (`failed`, `stalled`,
  `completed`) via `@OnWorkerEvent` and log with the Nest `Logger`;
  emit metrics/alerts on repeated failures and on `stalled`.

## 7. Concurrency, rate limiting, graceful shutdown

- Set worker `concurrency` per processor to bound parallel work.
- Use BullMQ queue `limiter` (max jobs per duration) for provider rate caps.
- Ensure Nest **graceful shutdown is enabled** (`app.enableShutdownHooks()`
  in `main.ts`) so workers finish/relinquish in-flight jobs on deploy.
  BullMQ workers close on the Nest lifecycle when using `@nestjs/bullmq`.
- Decide **where workers run:** same process as the API (simplest) vs. a
  separate entrypoint (`main.worker.ts` booting a slimmed module with only
  the queue + processor modules) for independent scaling. Start co-located,
  split later if load requires.

## 8. Scheduled / recurring jobs

- BullMQ **repeatable jobs** (cron or every-N-ms) for periodic work
  (e.g. mark hackathons inactive after `endDate`, sweep failed jobs,
  send reminders).
- Register them on module init (idempotent — BullMQ dedupes by repeat key).
- Alternative for simple in-process crons without Redis: `@nestjs/schedule`
  — but prefer BullMQ repeatables so scheduling is also durable and
  distributed-safe.

## 9. Wiring into existing request flow

- Controllers/services call `<feature>.queue.ts` `enqueueXxx(...)` instead
  of doing slow work inline (e.g. after `HackathonsService.join`, enqueue
  a "welcome / confirmation email" job rather than awaiting the mail send).
- The HTTP response returns immediately; the `TransformInterceptor`
  envelope is unaffected.
- Never block the request on job completion.

## 10. Local dev & ops

- `docker-compose.yml` service for Redis (dev/CI).
- Bull Board mounted behind an admin-only route (reuse the existing
  `@Roles([Role.ADMIN])` guard from `@thallesp/nestjs-better-auth`).
- CI: run Redis as a service container for e2e tests, or use an in-memory
  fake / disable the queue with a config flag in unit tests.

## 11. Testing approach

- **Unit:** mock the injected `Queue` (assert `add` called with the right
  job name + payload + options); test processor `process()` by calling it
  with a fake `Job`.
- **Integration:** real Redis, `attempts: 1`, run a job end-to-end, assert
  side effects and that failures land in the `failed` set.

## 12. Rollout checklist

1. Add Redis infra + env vars.
2. Add `src/lib/queue/` global module with default job options.
3. Pick the first feature to move async (email on join is a good start).
4. Add feature `*.queue.ts` + `*.processor.ts`, register queue in module.
5. Replace the inline slow call with an `enqueue`.
6. Add worker event logging + failure alerting.
7. Add Bull Board behind admin auth.
8. Load-test, then decide whether to split workers into their own process.
