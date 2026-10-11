# ADR 004: PostgreSQL access and migration strategy

- Status: accepted
- Date: 2026-10-09

## Context

RailBridge needs PostgreSQL constraints, transactions, explicit SQL, safe connection lifecycle, and typed row mapping without coupling the payment domain to an ORM. Schema changes must be reproducible in local development, CI, and deployment.

## Decision

Use PostgreSQL 18, `pg` connection pools, Drizzle ORM for typed SQL construction, and Drizzle Kit for versioned SQL generation.

The TypeScript schema is the code-first description used to generate migrations. Generated SQL is committed and reviewed before application. Deployments and local setup run `pnpm db:migrate` as an explicit step. The application does not run DDL automatically during ordinary startup.

`DatabaseModule` owns one `pg.Pool`, creates the Drizzle client, and closes the pool during Nest application shutdown. The raw pool is not exported. Infrastructure repositories receive an explicit database token; application services receive repository interfaces through explicit feature tokens.

Drizzle row types stop at the infrastructure boundary. Mappers reconstruct framework-free domain values and perform explicit `bigint`/money/date conversions.

Readiness executes a real query with a transaction-local PostgreSQL `statement_timeout` and confirms the required `payments` table exists. A successful TCP connection alone is insufficient.

## Consequences

- Migration SQL and indexes are visible in code review.
- A missing migration makes readiness fail instead of allowing traffic into an incompatible instance.
- Application startup cannot race multiple replicas applying DDL.
- Local and CI setup must run migrations before expecting readiness.
- Drizzle and `pg` remain infrastructure dependencies and never enter `src/domain`.
- PostgreSQL-specific failures are translated at the repository boundary when application code needs to act on them.

## Alternatives considered

- ORM schema synchronization on startup: rejected because implicit production DDL is difficult to coordinate and review.
- `drizzle-kit push` as the deployment workflow: useful for disposable prototyping, but rejected for controlled environments because it does not provide the same reviewed migration history.
- Raw `pg` only: viable, but Drizzle provides useful typed schema/query construction while preserving SQL visibility.
- In-memory database tests: rejected because they cannot prove PostgreSQL enums, check constraints, locking, query plans, or SQLSTATE behavior.

## Review triggers

- Migrations require a zero-downtime expand/contract process.
- Connection pooling moves outside the process or uses transaction-mode pooling.
- A separate worker deployment needs a different pool budget.
- Schema ownership splits across independently deployed services.
