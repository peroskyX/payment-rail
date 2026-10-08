# ADR 001: NestJS modular monolith

- Status: accepted
- Date: 2026-10-08

## Context

RailBridge needs clear payment capability boundaries, HTTP and worker entry points, dependency lifecycle management, and company-style conventions. Beginning with distributed services would add network consistency problems before the domain is understood.

## Decision

Use NestJS with its default HTTP platform as a modular monolith. Nest modules organize capabilities and infrastructure. Payment domain types and policies remain plain TypeScript and do not import NestJS.

The first modules are configuration, observability, and health. Payment modules are added only when their stage begins.

## Consequences

- Controllers and Nest providers are adapters/orchestrators, not the domain.
- The application gets consistent DI, lifecycle hooks, pipes, filters, guards, and worker integration.
- Developers must understand provider tokens and module visibility.
- Excessive decorators/global modules can hide dependencies, so they are used deliberately.
- API and worker processes can later use different root modules without splitting the domain into services.

## Alternatives

- Direct lightweight HTTP framework: fewer abstractions, but less representative of the desired team architecture.
- Microservices: rejected until an ownership/scaling/failure boundary justifies the consistency cost.
- NestJS with a different HTTP adapter: unnecessary for Stage 1.

## Review triggers

- A module needs independent scaling or ownership.
- Deployment/failure isolation requires a process boundary.
- Framework coupling appears in payment domain tests.
