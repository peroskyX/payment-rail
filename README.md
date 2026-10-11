# RailBridge

RailBridge is a learning-first multi-provider payment connector and reliability platform. It is being implemented stage by stage from the [NestJS implementation handbook](IMPLEMENTATION_ROADMAP.md).

This project uses test/simulated money only. It is not a production payment system.

## Current progress

Stage 3 persists the canonical payment domain in PostgreSQL with explicit concurrency and history guarantees. No payment endpoints or provider integrations exist yet.

Implemented:

- strict TypeScript and NestJS modular application shell;
- validated startup configuration;
- structured Pino request logs with safe correlation IDs;
- liveness and PostgreSQL TCP-readiness endpoints;
- canonical error responses and global DTO validation policy;
- graceful shutdown hooks;
- PostgreSQL Docker Compose service;
- unit and application-level tests;
- CI quality pipeline and initial ADRs.
- integer-minor-unit `Money` with reviewed currency metadata;
- separate logical payment, provider-attempt, and fulfillment concepts;
- explicit canonical payment and fulfillment transition tables;
- evidence/source requirements and immutable transition descriptions;
- narrow reconciliation-only late-success correction;
- canonical provider error taxonomy separated from recovery action;
- exhaustive domain tests that run without NestJS.
- reviewed Drizzle SQL migrations for the initial PostgreSQL model;
- typed `pg`/Drizzle database module with graceful pool shutdown;
- repository ports, explicit row/domain mapping, and a PostgreSQL adapter;
- atomic current-state update plus immutable transition history;
- optimistic versions for payment and attempt transition races;
- database constraints and scoped uniqueness for financial references;
- query-and-schema PostgreSQL readiness instead of a TCP-only probe;
- real PostgreSQL integration tests through Testcontainers.

## Prerequisites

- Node.js 24 LTS
- pnpm 11
- Docker Desktop with Docker Compose, if running PostgreSQL locally

## Setup

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL with `docker compose up -d postgres`.
3. Install dependencies with `pnpm install`.
4. Apply migrations with `pnpm db:migrate`.
5. Start the application with `pnpm start:dev`.

Endpoints:

- `GET /health/live` — process liveness;
- `GET /health/ready` — mandatory dependency readiness.

The Compose database uses host port `5433` by default to avoid conflicting with a PostgreSQL instance already using the conventional host port `5432`. Inside the container, PostgreSQL still listens on `5432`.

PostgreSQL 18 stores its version-specific data directory beneath `/var/lib/postgresql`, so the named volume is mounted at that parent directory rather than the pre-18 `/var/lib/postgresql/data` location.

## Quality commands

- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:integration`
- `pnpm test:coverage`
- `pnpm build`

Database commands:

- `pnpm db:generate --name=describe_the_change`
- `pnpm db:migrate`
- `pnpm db:studio`

## Understanding Stages 1–3

Read:

- [Stage 1 guide](docs/implementation/01-nestjs-foundation.md)
- [Stage 1 architecture walkthrough](docs/architecture/stage-1-foundation.md)
- [ADR 001: NestJS modular monolith](docs/adr/001-nestjs-modular-monolith.md)
- [ADR 002: Configuration and secrets](docs/adr/002-configuration-and-secrets-boundary.md)
- [Stage 2 guide](docs/implementation/02-domain-state-machines.md)
- [Stage 2 architecture walkthrough](docs/architecture/stage-2-domain-model.md)
- [ADR 003: Canonical payment domain](docs/adr/003-canonical-payment-domain.md)
- [Stage 3 guide](docs/implementation/03-postgresql-persistence.md)
- [Stage 3 architecture walkthrough](docs/architecture/stage-3-persistence.md)
- [ADR 004: PostgreSQL and migrations](docs/adr/004-postgresql-drizzle-migrations.md)
- [ADR 005: Transition concurrency](docs/adr/005-optimistic-transition-concurrency.md)
- [Provider evidence retention](docs/architecture/provider-evidence-retention.md)

The next implementation stage is [API idempotency](docs/implementation/04-api-idempotency.md).
