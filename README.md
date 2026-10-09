# RailBridge

RailBridge is a learning-first multi-provider payment connector and reliability platform. It is being implemented stage by stage from the [NestJS implementation handbook](IMPLEMENTATION_ROADMAP.md).

This project uses test/simulated money only. It is not a production payment system.

## Current progress

Stage 2 establishes the framework-free canonical payment domain and state machines. No payment endpoints or provider integrations exist yet.

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

## Prerequisites

- Node.js 24 LTS
- pnpm 11
- Docker Desktop with Docker Compose, if running PostgreSQL locally

## Setup

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL with `docker compose up -d postgres`.
3. Install dependencies with `pnpm install`.
4. Start the application with `pnpm start:dev`.

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
- `pnpm test:coverage`
- `pnpm build`

## Understanding Stages 1 and 2

Read:

- [Stage 1 guide](docs/implementation/01-nestjs-foundation.md)
- [Stage 1 architecture walkthrough](docs/architecture/stage-1-foundation.md)
- [ADR 001: NestJS modular monolith](docs/adr/001-nestjs-modular-monolith.md)
- [ADR 002: Configuration and secrets](docs/adr/002-configuration-and-secrets-boundary.md)
- [Stage 2 guide](docs/implementation/02-domain-state-machines.md)
- [Stage 2 architecture walkthrough](docs/architecture/stage-2-domain-model.md)
- [ADR 003: Canonical payment domain](docs/adr/003-canonical-payment-domain.md)

The next implementation stage is [PostgreSQL persistence and concurrency](docs/implementation/03-postgresql-persistence.md).
