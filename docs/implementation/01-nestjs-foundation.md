# Stage 1 — NestJS application foundation

[Previous: Business discovery](00-business-discovery.md) | [Back to index](README.md) | [Next: Domain state machines](02-domain-state-machines.md)

## Outcome

A minimal NestJS application starts predictably, validates configuration, exposes health endpoints, produces structured correlated logs, and passes automated quality checks. There is still no payment functionality.

## Why NestJS here

NestJS gives a real-world team structure: modules define capability boundaries, controllers own transport concerns, providers participate in dependency injection, and lifecycle hooks manage resources. Learn these mechanics now so they do not distract you when financial behavior arrives.

## Concepts to understand first

- Root module versus feature module.
- Controller versus provider.
- Import, provider, controller, and export metadata.
- Runtime injection token versus erased TypeScript interface.
- Singleton provider scope and why request scope should be rare.
- Pipe, guard, interceptor, exception filter, and middleware responsibilities.
- Application bootstrap and graceful shutdown lifecycle.
- Unit testing a class versus compiling a Nest testing module.

## Initial modules

Create only:

- `AppModule` as the composition root;
- `ConfigurationModule` for validated settings;
- `HealthModule` for liveness/readiness;
- `ObservabilityModule` for logger/correlation infrastructure.

Do not create empty modules for all future stages.

## Implementation sequence

1. Initialize a strict TypeScript NestJS application using the default HTTP platform.
2. Decide ESM or CommonJS deliberately and document the choice; do not mix styles accidentally.
3. Enable strict compiler checks and consistent lint/format rules.
4. Configure `@nestjs/config` with startup validation. Reject missing database URL, invalid environment name, or invalid port.
5. Add a global `ValidationPipe` with an explicit policy for transformation, unknown properties, and validation error shape.
6. Define one canonical HTTP error envelope and implement it through an exception filter without exposing stack traces.
7. Accept or generate a correlation ID at the boundary, attach it to async execution context, return it to the caller, and include it in logs.
8. Use structured JSON logging. Configure redaction before provider secrets exist.
9. Add liveness and readiness using `@nestjs/terminus`. Liveness means the process can respond; readiness means mandatory dependencies are usable.
10. Enable graceful shutdown hooks and document what must eventually drain: HTTP requests, database connections, queue workers, and telemetry.
11. Add Docker Compose with PostgreSQL only.
12. Add CI for install, type check, lint, unit tests, and build.

## Architectural rules

- `AppModule` composes modules but contains no business logic.
- Configuration is injected as typed groups rather than arbitrary string lookups scattered everywhere.
- Do not mark configuration/database modules global merely to save imports until you understand the dependency trade-off.
- Controllers never read `process.env`.
- Domain classes will later remain undecorated and framework-free.
- Avoid Nest CLI-generated CRUD resources; they encourage data-oriented scaffolding before the payment model exists.

## Tests

- Application fails to bootstrap for each missing/invalid required setting.
- Liveness responds without checking external dependencies.
- Readiness becomes unhealthy when PostgreSQL is unavailable.
- Invalid DTO input returns the canonical error envelope.
- Unknown request fields follow your documented whitelist policy.
- Correlation ID is generated when absent and preserved when valid.
- Expected sensitive keys are redacted from structured logs.
- Shutdown closes the application without hanging.

## Documentation deliverables

- ADR: NestJS modular monolith and default HTTP platform.
- ADR: configuration validation and secret-source boundary.
- Diagram showing bootstrap, global pipes/filters/interceptors, and feature modules.
- README instructions for local startup and checks.

## Common traps

- Putting business logic in controllers.
- Making every utility injectable.
- Using request-scoped providers for correlation when async context is sufficient.
- Treating DTO classes as domain entities.
- Importing one giant shared module everywhere.
- Returning Nest/HTTP exceptions from domain logic.

## Acceptance gate

- A clean checkout starts with one documented command sequence.
- CI is green.
- Invalid configuration stops startup clearly.
- Health, validation, errors, correlation, logs, and shutdown are tested.
- You can explain every provider registered in the initial modules and why it needs injection.

## Questions to answer aloud

1. Why does Nest need injection tokens for interfaces?
2. What is the difference between a controller, application provider, and domain object?
3. What belongs in a global interceptor versus a domain service?
4. Why are liveness and readiness separate?
5. How could excessive Nest decorators make domain logic harder to reuse?
