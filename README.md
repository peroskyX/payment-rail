# RailBridge

RailBridge is a learning-first multi-provider payment connector and reliability platform. It is being implemented stage by stage from the [NestJS implementation handbook](IMPLEMENTATION_ROADMAP.md).

This project uses test/simulated money only. It is not a production payment system.

## Current progress

Stage 1 establishes the NestJS application foundation. No payment endpoints or provider integrations exist yet.

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

## Understanding Stage 1

Read:

- [Stage 1 guide](docs/implementation/01-nestjs-foundation.md)
- [Stage 1 architecture walkthrough](docs/architecture/stage-1-foundation.md)
- [ADR 001: NestJS modular monolith](docs/adr/001-nestjs-modular-monolith.md)
- [ADR 002: Configuration and secrets](docs/adr/002-configuration-and-secrets-boundary.md)

The next implementation stage is the framework-free [canonical domain model and state machines](docs/implementation/02-domain-state-machines.md).
