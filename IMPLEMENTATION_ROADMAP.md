# RailBridge: NestJS Learning-First Implementation Handbook

> An implementation curriculum for building a multi-provider payment connector and reliability platform yourself. This repository contains guidance and design work only; it does not contain the project implementation.

## What changed

The project now uses **NestJS** as its application framework with the default Nest HTTP platform. Each implementation stage has its own expanded Markdown guide under [`docs/implementation`](docs/implementation/README.md).

The payment domain must still remain independent of NestJS. Controllers, decorators, dependency injection, queue processors, and database providers are delivery/infrastructure mechanisms; payment state transitions, money rules, routing policy, retry safety, and reconciliation rules are plain TypeScript domain logic.

## Target architecture

```text
HTTP clients and provider callbacks
               |
               v
        NestJS Controllers
      DTO validation / guards
               |
               v
     Application use-case services
               |
      +--------+---------+
      |                  |
      v                  v
Plain TypeScript      Domain ports
payment domain       and policies
      |                  |
      +--------+---------+
               |
       NestJS providers/adapters
        |        |        |
        v        v        v
   PostgreSQL  BullMQ   Provider APIs
```

Begin as a modular monolith with separate NestJS entry points for the HTTP API and background workers. Use one repository and one PostgreSQL database. Do not begin with microservices.

## Recommended stack

Use current compatible stable releases and commit the lockfile. Recheck official documentation when you reach each stage.

| Area                  | Recommendation                                                | Reason                                                                                                                                              |
| --------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime               | Node.js 24 LTS                                                | Use an active LTS runtime for production-style work.                                                                                                |
| Language              | Strict TypeScript                                             | Makes state unions, provider contracts, error categories, and missing cases explicit.                                                               |
| Application framework | NestJS                                                        | Gives a company-style module system, dependency injection, lifecycle hooks, guards, pipes, interceptors, testing utilities, and worker integration. |
| HTTP platform         | NestJS default HTTP platform                                  | Keeps transport setup conventional while the payment domain remains platform-independent.                                                           |
| Request validation    | Nest `ValidationPipe`, `class-validator`, `class-transformer` | Conventional Nest DTO validation. Explicitly learn what transformation, whitelisting, and rejection settings do.                                    |
| Configuration         | `@nestjs/config` with startup schema validation               | Fails startup when required configuration or provider references are invalid.                                                                       |
| API description       | `@nestjs/swagger`                                             | Generates OpenAPI documentation from the Nest API contract.                                                                                         |
| Health                | `@nestjs/terminus`                                            | Standard liveness/readiness structure with custom PostgreSQL and Redis indicators.                                                                  |
| Database              | PostgreSQL                                                    | Transactions, constraints, conditional updates, and locks form the correctness boundary.                                                            |
| Database access       | Drizzle ORM, Drizzle Kit, and `pg`                            | Typed, SQL-like access while keeping generated SQL and locking behavior visible.                                                                    |
| Jobs                  | Redis, BullMQ, and `@nestjs/bullmq`                           | Delayed polling, bounded retries, worker processes, and DLQ workflows.                                                                              |
| Logging               | Pino through `nestjs-pino` or a small Nest logger adapter     | Structured JSON logs with correlation data and redaction. Keep domain code logger-agnostic.                                                         |
| Testing               | Vitest plus Nest testing utilities                            | Fast unit tests and Nest module/controller integration tests.                                                                                       |
| Real database tests   | Testcontainers for Node.js                                    | Proves actual PostgreSQL constraints, transactions, and concurrency.                                                                                |
| Metrics               | `prom-client` and Prometheus                                  | Payment- and provider-specific counters, gauges, and histograms.                                                                                    |
| Tracing               | OpenTelemetry JavaScript with OTLP exporters                  | Correlates API, worker, database, provider, and event activity.                                                                                     |
| Dashboards            | Grafana                                                       | Makes reliability and operations behavior demonstrable.                                                                                             |
| Load tests            | k6                                                            | Reproducible scenarios and pass/fail thresholds.                                                                                                    |
| Local environment     | Docker Compose                                                | Reproducible PostgreSQL, Redis, Prometheus, Grafana, and mock providers.                                                                            |
| CI                    | GitHub Actions                                                | Type checking, migrations, unit/integration tests, conformance tests, and security checks.                                                          |

## NestJS boundaries

Use modules to express business capabilities, not generic technical folders alone.

| NestJS module          | Responsibility                                                 |
| ---------------------- | -------------------------------------------------------------- |
| `PaymentsModule`       | Canonical payment use cases and lifecycle orchestration        |
| `ConnectorsModule`     | Provider registry and adapter providers                        |
| `RoutingModule`        | Eligibility, configuration resolution, and provider selection  |
| `WebhookInboxModule`   | Admission, authentication, deduplication, and async processing |
| `PollingModule`        | Scheduled status repair and exhaustion policy                  |
| `OutboxModule`         | Reliable event publication                                     |
| `FulfillmentModule`    | Simulated credit/reserve/finalize/release boundary             |
| `ReconciliationModule` | Comparison, exception classification, and controlled repair    |
| `OperationsModule`     | Search, timeline, runbooks, and authenticated manual commands  |
| `ObservabilityModule`  | Logging context, metrics, traces, and health                   |
| `DatabaseModule`       | Database client and transaction boundary infrastructure        |
| `ConfigurationModule`  | Typed runtime configuration and secrets references             |

Rules:

- Controllers translate transport input and invoke a use case; they contain no payment policy.
- Nest providers orchestrate work but must delegate state rules to plain domain objects/functions.
- Domain code does not import `@nestjs/*`, Drizzle, BullMQ, HTTP clients, or provider DTOs.
- Repository and connector interfaces are defined toward the domain/application layer; infrastructure implements them.
- Avoid global modules except for truly application-wide infrastructure that is deliberately documented.
- Use explicit provider tokens for interfaces because TypeScript interfaces do not exist at runtime.
- Test domain logic without creating a Nest testing module.
- Test Nest wiring separately so dependency-injection convenience does not obscure business correctness.

## Package introduction order

| Stage | Add                                                                                                                                                                              | Why now                                                            |
| ----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
|     1 | `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`, `@nestjs/config`, `@nestjs/terminus`, `class-validator`, `class-transformer`, `reflect-metadata`, `rxjs`, `vitest` | Application shell, validation, configuration, health, and testing  |
|     3 | `pg`, `drizzle-orm`, `drizzle-kit`, `@testcontainers/postgresql`                                                                                                                 | Persistence and real database correctness tests                    |
|     5 | Built-in `fetch`; optionally Mock Service Worker for HTTP fixtures                                                                                                               | Explicit provider transport behavior without an unofficial SDK     |
|     8 | `@nestjs/swagger`                                                                                                                                                                | Publish the canonical API after its initial contract is understood |
|     9 | Node `crypto`; raw-body support from Nest's HTTP platform configuration                                                                                                          | Exact webhook-signature verification                               |
|    10 | `@nestjs/bullmq`, `bullmq`, Redis client dependencies                                                                                                                            | Polling and durable delayed work                                   |
|    17 | `prom-client`, OpenTelemetry API/SDK/exporters, `nestjs-pino` if selected                                                                                                        | Production-oriented observability                                  |
|    18 | `@nestjs/throttler`, authentication/authorization packages selected for the admin API                                                                                            | Security hardening after trust boundaries are defined              |
|    19 | k6 CLI                                                                                                                                                                           | Load, concurrency, and chaos evidence                              |

Do not add every package in Stage 1. Install a dependency when you can state the concrete requirement it solves and the new failure mode it introduces.

## External integration order

1. **GoodProvider:** a local, predictable provider service.
2. **ChaosPay:** a local provider simulator with deterministic failure modes.
3. **Paystack test mode:** first real connector, using hosted/test flows and server-side verification.
4. **Kora sandbox:** second real connector, selected to challenge the canonical model with different regional capabilities.
5. **Cloudflare Tunnel or ngrok:** development-only callback exposure when a provider must reach localhost.
6. **Secrets manager:** deployment-stage credential storage by environment, entity, and provider.

Use only sandbox/test credentials and simulated money. Never store raw card numbers.

## Core invariants

Every stage must preserve these:

1. A successful deposit is credited at most once.
2. A withdrawal is paid at most once.
3. One logical idempotent request creates at most one logical payment.
4. Repeated provider events cannot repeat financial effects.
5. Provider success and internal fulfillment are separate facts.
6. Every state change is validated and recorded immutably.
7. Old events cannot regress terminal state.
8. A timeout means unknown outcome unless later evidence proves otherwise.
9. Unknown outcomes are never automatically cascaded.
10. State changes and their outbox records commit atomically.
11. Every external success becomes internally reflected or a reconciliation exception.
12. Reference, amount, and currency must match before value delivery.
13. Total refunds cannot exceed the captured amount.
14. Routing respects entity, operation, market, method, amount, capability, and enabled state.
15. Money-affecting configuration and manual commands are auditable.
16. Secrets and sensitive payment data never enter logs.

## Stage index

| Stage | Guide                                                                                    | Result                                                        |
| ----: | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
|     0 | [Business discovery and charter](docs/implementation/00-business-discovery.md)           | Business model, glossary, scope, and invariants               |
|     1 | [NestJS foundation](docs/implementation/01-nestjs-foundation.md)                         | Modular application shell, configuration, health, logging, CI |
|     2 | [Canonical domain and state machines](docs/implementation/02-domain-state-machines.md)   | Framework-free payment and fulfillment rules                  |
|     3 | [PostgreSQL persistence](docs/implementation/03-postgresql-persistence.md)               | Transactional schema, repositories, and concurrency boundary  |
|     4 | [API and idempotency](docs/implementation/04-api-idempotency.md)                         | Canonical deposit API safe under retries and races            |
|     5 | [Connector contract and GoodProvider](docs/implementation/05-connector-good-provider.md) | Provider-independent adapter boundary                         |
|     6 | [Capabilities, entities, and routing](docs/implementation/06-configuration-routing.md)   | Auditable configuration-driven provider selection             |
|     7 | [ChaosPay simulator](docs/implementation/07-chaos-provider.md)                           | Repeatable provider failure laboratory                        |
|     8 | [Paystack connector](docs/implementation/08-paystack-connector.md)                       | First real sandbox connector                                  |
|     9 | [Webhook inbox](docs/implementation/09-webhook-inbox.md)                                 | Authenticated, durable, idempotent callbacks                  |
|    10 | [Polling and retry safety](docs/implementation/10-polling-retries.md)                    | Missing-webhook and unknown-result recovery                   |
|    11 | [Outbox and fulfillment](docs/implementation/11-outbox-fulfillment.md)                   | Reliable event delivery and one simulated credit              |
|    12 | [Reconciliation](docs/implementation/12-reconciliation.md)                               | Independent comparison and controlled repair                  |
|    13 | [Kora connector](docs/implementation/13-kora-connector.md)                               | Second heterogeneous sandbox connector                        |
|    14 | [Withdrawal saga](docs/implementation/14-withdrawal-saga.md)                             | Reservation, payout, finalization, and compensation           |
|    15 | [Refunds](docs/implementation/15-refunds.md)                                             | Independent full/partial refund lifecycle                     |
|    16 | [Cascading and resilience controls](docs/implementation/16-cascading-resilience.md)      | Safe provider fallback, circuit breaker, and DLQ              |
|    17 | [Observability](docs/implementation/17-observability.md)                                 | Logs, metrics, traces, dashboard, and payment timeline        |
|    18 | [Security and audit](docs/implementation/18-security-audit.md)                           | Threat model, access control, redaction, and auditability     |
|    19 | [Concurrency, chaos, and load testing](docs/implementation/19-testing-load.md)           | Evidence-backed correctness and performance                   |
|    20 | [Production ownership and demo](docs/implementation/20-production-ownership.md)          | ADRs, runbooks, RCA, reproducible final presentation          |

## Milestones

| Milestone              | Stages | Meaning                                                                                 |
| ---------------------- | -----: | --------------------------------------------------------------------------------------- |
| Domain foundation      |    0–3 | You understand and persist the business model correctly.                                |
| First platform slice   |    4–7 | API, idempotency, adapters, routing, and deterministic failures exist.                  |
| Reliability core       |   8–12 | Real sandbox, webhooks, polling, outbox, fulfillment, and reconciliation work together. |
| Connector proof        |     13 | A second provider proves the abstraction is not provider-shaped.                        |
| Broader operations     |  14–16 | Withdrawals, refunds, fallback, and failure containment are explicit.                   |
| Interview-ready system |  17–20 | The system is observable, secure, tested, documented, and demonstrable.                 |

If time is limited, complete Stages 0–12 and 17–20 before adding breadth. Two deep connectors are more valuable than ten shallow wrappers.

## Official starting references

- [NestJS architecture](https://docs.nestjs.com/applications/architecture)
- [NestJS modules](https://docs.nestjs.com/modules)
- [NestJS providers](https://docs.nestjs.com/providers)
- [NestJS validation](https://docs.nestjs.com/techniques/validation)
- [NestJS configuration](https://docs.nestjs.com/techniques/configuration)
- [NestJS queues](https://docs.nestjs.com/techniques/queues)
- [NestJS OpenAPI](https://docs.nestjs.com/openapi/introduction)
- [NestJS health checks](https://docs.nestjs.com/recipes/terminus)
- [PostgreSQL](https://www.postgresql.org/docs/current/)
- [Drizzle ORM](https://orm.drizzle.team/docs/overview)
- [Paystack documentation](https://paystack.com/docs/)
- [Kora documentation](https://developers.korapay.com/)
- [OpenTelemetry JavaScript](https://opentelemetry.io/docs/languages/js/)
- [Grafana k6](https://grafana.com/docs/k6/latest/)

Start with [Stage 0](docs/implementation/00-business-discovery.md). Do not scaffold the NestJS application until its acceptance gate is complete.
