# Stage 1 architecture walkthrough

## Request path

1. The Nest default HTTP platform accepts a request.
2. Pino generates or validates `x-correlation-id`, returns it as a response header, and binds it to request logs.
3. Nest routes the request to a controller.
4. The global validation pipe transforms a DTO only where explicitly described and rejects unknown fields.
5. The controller delegates to an application provider. Stage 1 has only health controllers.
6. Any thrown error reaches the canonical exception filter.
7. The filter maps it to a stable error envelope and hides unexpected internal details.

## Module graph

```text
AppModule
├── ConfigurationModule
│   └── ConfigModule (global, validated at startup)
├── ObservabilityModule
│   └── LoggerModule / Pino request context
└── HealthModule
    ├── TerminusModule
    ├── HealthController
    └── PostgresHealthIndicator (upgraded in Stage 3)
```

`AppModule` is the composition root. It decides which capabilities form this executable. It contains no workflow logic.

## Configuration

`EnvironmentVariables` is both the startup schema and the typed contract consumed by infrastructure. Numeric strings are converted only during startup validation. Invalid values prevent the application from listening.

The `.env.example` file documents names and safe local values. `.env` is ignored because real provider/database credentials must not be committed.

## Validation

The global pipe uses:

- `whitelist`: only decorated DTO properties survive;
- `forbidNonWhitelisted`: unexpected input is rejected rather than silently ignored;
- no implicit DTO conversion: avoids surprising conversions such as arbitrary strings to booleans;
- a stable `VALIDATION_ERROR` shape.

DTO validation is not business validation. A future amount DTO may prove that a value is an integer, while the payment domain decides whether it is within configured provider/business limits.

## Correlation IDs

A safe caller-provided identifier is preserved; unsafe or missing values are replaced with a UUID. Restricting the characters and length prevents header/log injection and unbounded values. This is diagnostic identity, not security authentication and not payment idempotency.

## Health

- Liveness answers whether the process and HTTP event loop can respond. It deliberately does not depend on PostgreSQL.
- Readiness answers whether the instance should receive useful traffic. Stage 1 probes the PostgreSQL TCP endpoint without introducing the `pg` driver before Stage 3.

A TCP connection does not prove credentials or schema readiness. Stage 3 replaces/extends this with an actual database query and migration/schema checks.

## Errors

The exception filter preserves known client-safe messages and codes. Unexpected server errors receive a generic message while the structured logger records the exception. This prevents stack traces and provider payloads from leaking to callers.

## Shutdown

Nest shutdown hooks allow infrastructure providers to close resources when the process receives termination signals. Stage 1 has few resources; later stages add database pools, BullMQ workers, and telemetry exporters that must drain.

## Why native ESM

NestJS 12 and the current TypeScript/Node ecosystem are ESM-oriented. The package declares `type: module`, TypeScript uses `NodeNext` resolution, and relative source imports use `.js` specifiers so the compiled files run directly in Node. This avoids transpiling modern ESM dependencies into incompatible `require` calls and makes the development and production module models agree.

## Detailed code tour

### `package.json`

The package is private because this is an application, not a library intended for accidental publication. `type: module` tells Node to interpret emitted `.js` files as ESM. The `engines` field documents the supported runtime; the lockfile records the exact dependency graph.

The scripts deliberately separate concerns:

- `start:dev` uses the Nest CLI's TypeScript watch compiler and restarts on changes;
- `build` proves production compilation;
- `start` runs only compiled JavaScript, catching differences hidden by a development loader;
- `typecheck` checks all source and tests without emitting files;
- `lint` checks correctness/style rules that types do not express;
- `test` is deterministic CI mode rather than watch mode;
- `format:check` checks without modifying files, which is appropriate for CI.

TypeScript is pinned to version 6 because the current `typescript-eslint` release does not yet support TypeScript 7. Using the newest version number blindly would leave linting broken; compatibility across the toolchain matters more than novelty.

### `tsconfig.json`

Important settings:

- `strict` forces nullability and unsafe assumptions to be handled explicitly.
- `noUncheckedIndexedAccess` makes indexed lookup potentially undefined, which is realistic for maps, arrays, and provider status tables.
- `noImplicitOverride` makes inheritance intentional.
- `experimentalDecorators` and `emitDecoratorMetadata` supply the runtime metadata Nest and `class-validator` use.
- `NodeNext` makes TypeScript follow Node's real ESM rules. That is why relative TypeScript imports use a `.js` specifier: after compilation, that is the file Node actually loads.
- `tsconfig.build.json` compiles only application source, while the normal config also checks tests/tooling.

`reflect-metadata` must be loaded before decorated classes are transformed or Nest builds its dependency graph. `main.ts` loads it for the application and `test/setup.ts` loads it for Vitest.

The development command deliberately uses `nest start --watch` rather than a direct `tsx` loader. Nest constructor injection depends on TypeScript's emitted `design:paramtypes` metadata. A lightweight loader may transform decorator syntax without emitting that metadata, leaving constructor-injected providers undefined even though the process appears to start. The Nest CLI's default TypeScript builder preserves the same decorator-metadata behavior used by the production build.

### `src/main.ts`

`main.ts` is the executable composition/bootstrap boundary, not a place for business logic.

`NestFactory.create(AppModule, { bufferLogs: true })` asks Nest to construct the module graph. Log buffering prevents early bootstrap messages from being lost before Pino becomes the application logger.

The code then resolves `Logger` and `ConfigService` from Nest's dependency-injection container. `app.useLogger(logger)` replaces the default Nest logger with structured Pino output. `enableShutdownHooks()` lets Nest notify providers when the operating system asks the process to stop. Later, the database pool, BullMQ workers, and telemetry exporters will use those hooks.

Only after configuration and providers have initialized does `app.listen` accept traffic. A startup validation error therefore fails before the process claims readiness.

### `src/app.module.ts`

`AppModule` is the composition root. Its imports answer: “Which capabilities make up this executable?” Stage 1 imports only configuration, observability, and health.

`APP_PIPE` and `APP_FILTER` are Nest framework tokens. Registering providers under these tokens makes validation and error mapping global for every controller. This is useful for transport consistency, but neither component is allowed to contain payment business rules.

`useFactory` creates the validation pipe explicitly. `useClass` tells Nest to instantiate the exception filter and inject its logger dependency. This illustrates two kinds of provider registration without creating unnecessary custom dependency-injection abstractions.

### Configuration files

`EnvironmentVariables` is a runtime schema expressed as a class because TypeScript interfaces vanish after compilation. Decorators such as `IsInt` and `IsUrl` are executable validation metadata.

The environment starts as strings. `plainToInstance` builds the schema instance and the numeric properties use explicit `@Type(() => Number)` conversion before `validateSync` checks them. Explicit conversion is important because development loaders such as `tsx` do not necessarily emit the design-type metadata that implicit conversion relies on. The returned object is the validated source used by `ConfigService`.

The distinction is important:

- TypeScript checks code written by developers.
- Runtime validation checks values supplied by a shell, container, deployment system, or secret store.

`ConfigurationModule` intentionally marks `ConfigModule` global because runtime configuration is infrastructure needed across the application. That convenience should not lead to scattered arbitrary key lookups. Future provider configuration should expose typed configuration groups.

`.env.example` contains only safe sample values. `.env` is ignored. When provider keys arrive, the same rule prevents accidental secret commits.

### Observability and correlation IDs

`ObservabilityModule` configures `nestjs-pino`, which connects Nest logging to Pino's structured request logger.

`resolveCorrelationId` accepts a caller's `x-correlation-id` only when it uses a restricted character set and length. This prevents newline/log injection and huge unbounded values. Missing or unsafe values become a UUID. The chosen value is returned in the response header and attached to the request logging context.

A correlation ID answers “which logs belong to this request?” It does **not** prove identity and does **not** make a payment idempotent. Later a single logical payment may have several correlation IDs across API request, webhook, polling job, and reconciliation run.

The Pino redaction list is defensive groundwork. It redacts common authentication and secret paths. Provider integration stages must extend it with provider-specific sensitive fields and prefer allowlisted diagnostic data.

### Request validation

The global validation pipe uses four intentional behaviors:

1. `transform` creates the declared DTO class so decorator validation runs.
2. Implicit conversion is disabled for request DTOs, avoiding surprising truthy/boolean or number conversions.
3. `whitelist` allows only decorated fields.
4. `forbidNonWhitelisted` rejects unknown fields rather than silently accepting a client/provider typo.

Its exception factory returns a stable error code and field details. The exception filter later adds correlation, timestamp, and path.

DTO validation checks transport shape. It must not become payment business validation. For example, `amountMinor` being an integer is DTO/domain-construction validation; whether that amount is within an entity/provider limit is routing/business policy.

### Canonical exception filter

The filter is the last HTTP-boundary translator. It receives any thrown value, selects an HTTP status, safely interprets known `HttpException` payloads, and returns one envelope.

For 4xx errors, approved client-safe messages can pass through. For 5xx errors, the caller receives a generic message while the detailed exception goes to structured logs. This avoids leaking stack traces, SQL, credentials, or raw provider bodies.

The response includes:

- stable machine code;
- human message;
- optional safe details;
- correlation ID;
- timestamp;
- request path.

Future domain errors should be translated into application/HTTP errors deliberately. Domain code should not throw Nest `HttpException`, because that would couple business rules to HTTP.

### Health endpoints

`HealthController` deliberately exposes two meanings:

- `/health/live` proves the process can answer. It must stay independent of PostgreSQL so an orchestrator does not repeatedly restart a healthy process during a database outage.
- `/health/ready` proves mandatory dependencies are usable enough to accept traffic.

The original Stage 1 indicator attempted a bounded TCP connection. Stage 3 replaced it with `PostgresHealthIndicator`, which runs a bounded PostgreSQL query and verifies the required migrated schema exists. Liveness remains independent of the database.

### Test structure

The five test files cover different boundaries:

- `environment.spec.ts` tests startup input conversion and rejection without Nest bootstrap.
- `correlation-id.spec.ts` tests valid preservation and unsafe-value replacement as a plain function.
- `request-validation.pipe.spec.ts` tests the global transport policy directly.
- `postgres.health-indicator.spec.ts` proves a failed query/schema check reports down.
- `app.e2e.spec.ts` compiles the real `AppModule`, overrides only the external dependency probe, starts a Nest application, and tests HTTP behavior.

The readiness override demonstrates Nest testing modules: production wiring is retained while one external boundary is substituted. Unit tests should not compile a Nest module when a plain object/function can be tested more clearly.

Coverage is diagnostic, not the definition of correctness. Stage 1 currently emphasizes the risky branches—invalid configuration, untrusted correlation input, unknown request fields, missing routes, and unavailable dependency—rather than chasing 100% mechanically.

## Experiments for you to perform

Do these yourself and predict the result first:

1. Remove `DATABASE_URL` and start the app. Read the bootstrap failure.
2. Set `PORT=70000` and observe startup validation.
3. Call liveness with a safe correlation ID, then with spaces/newline-encoded characters.
4. Stop PostgreSQL and compare liveness with readiness.
5. Temporarily throw an ordinary `Error` from liveness and inspect the client response versus structured log.
6. Add an undecorated field to the test DTO and observe whitelist behavior.
7. Remove `reflect-metadata` from the test setup and connect the failure to decorator metadata.
8. Run compiled code with `pnpm build && pnpm start`, not only the development loader.

Revert each experiment after you understand it, then add a test if it revealed behavior the project should guarantee.
