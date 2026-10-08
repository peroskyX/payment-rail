# Stage 5 — Canonical connector contract and GoodProvider

[Previous: API idempotency](04-api-idempotency.md) | [Back to index](README.md) | [Next: Configuration and routing](06-configuration-routing.md)

## Outcome

Core payment orchestration speaks one provider-independent language. A predictable local provider proves the full HTTP boundary without allowing an external API to design your domain.

## Business reason

Providers disagree about authentication, fields, statuses, errors, webhook formats, capabilities, and retry behavior. Without a connector boundary, these differences leak into every use case and make replacement or reuse expensive.

## Connector responsibilities

A canonical connector port should support, where declared:

- provider identity and capability description;
- payment creation;
- status lookup by stable reference;
- webhook authentication/parsing into canonical evidence;
- refund creation/status later;
- withdrawal creation/status later;
- reconciliation-record retrieval/normalization later;
- canonical error classification plus provider diagnostics.

The adapter translates. It does **not** decide credit, retry, routing, cascading, or repair policy.

## NestJS composition

- Define connector interfaces/tokens toward the application/domain side.
- Adapter classes may be Nest providers because they need configuration and HTTP transport.
- A connector registry resolves a provider ID to an adapter and validates unique registration.
- Avoid injecting every provider into the payment service constructor. Inject the registry port.
- Dynamic-module registration is optional; use it only after understanding ordinary provider registration.
- Keep provider DTOs and runtime schemas inside that adapter package/module.

## GoodProvider

Build GoodProvider as a separate local NestJS application or standalone mock service with its own port. It should:

- accept stable merchant references;
- enforce provider-side uniqueness/idempotency deliberately;
- return provider reference and processing state;
- support status lookup;
- emit signed callbacks;
- allow deterministic success/failure advancement;
- later expose refund, payout, and reconciliation fixtures.

An actual HTTP boundary teaches timeouts, abort signals, serialization, malformed data, authentication, and raw webhook bytes. Do not make GoodProvider an in-memory class inside RailBridge.

## Outbound HTTP policy

Use Node's built-in fetch or a small injected transport wrapper. The wrapper should require:

- explicit timeout/cancellation;
- sanitized request/response logging;
- runtime response validation;
- provider correlation/reference fields;
- mapping transport failures separately from business failures;
- no automatic retry of unsafe operations.

## Connector conformance suite

Create reusable behavioral tests covering applicable capabilities:

- declared capabilities are coherent;
- create returns a deterministic canonical result;
- documented statuses map correctly;
- unknown status remains explicit;
- malformed success body fails safely;
- 401/403, 429, 5xx, and timeout classification;
- stable reference lookup;
- valid/invalid webhook signature behavior;
- no provider-specific status outside evidence/adapter boundaries.

## Tests and failure exercises

- Make GoodProvider return an undocumented field/status.
- Drop the response after accepting a payment; assert unknown outcome.
- Return HTTP 200 with business failure.
- Confirm no automatic unsafe retry occurs.
- Replace GoodProvider with a fake connector in application unit tests without changing orchestration.

## Documentation deliverables

- ADR: canonical connector boundary.
- Capability vocabulary.
- Provider onboarding checklist.
- GoodProvider API behavior and conformance report.

## Acceptance gate

- Payment core imports no GoodProvider types.
- GoodProvider is accessed over HTTP.
- Provider-specific statuses do not escape the adapter.
- The conformance suite can be pointed at another connector implementation.

## Questions to answer aloud

1. Why must adapters be thin?
2. Where should runtime response validation happen?
3. Why should the connector classify an unknown result but not decide to retry it?
4. How does Nest dependency injection resolve an interface token?
5. What test proves that the canonical model is not GoodProvider-shaped?
