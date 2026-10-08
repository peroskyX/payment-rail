# Stage 6 — Capabilities, multi-entity configuration, and routing

[Previous: Connector contract](05-connector-good-provider.md) | [Back to index](README.md) | [Next: ChaosPay](07-chaos-provider.md)

## Outcome

RailBridge selects an eligible provider through auditable configuration rather than brand-specific conditionals.

## Business reason

Legal entities can have different contracts, credentials, markets, currencies, limits, operations, and compliance restrictions. The connector code should remain reusable while configuration determines availability.

## Model

Add configuration for:

- provider capabilities;
- legal entity and environment;
- credentials **reference**, never secret value;
- operation: deposit, withdrawal, refund;
- method and rail;
- country and currency;
- minimum/maximum amount;
- enabled state and effective window;
- static priority;
- provider-specific polling/retry policy references later;
- audit metadata and version.

## Routing algorithm

Make every step explicit and return a decision trace:

1. Resolve legal entity and operation.
2. Load effective enabled configuration.
3. Filter by country, currency, method, and amount.
4. Check connector-declared capabilities.
5. Require a valid credentials reference for provider/entity/environment.
6. Apply policy eligibility.
7. Sort by static priority and stable tie-breaker.
8. Select one provider or return a canonical no-route reason.

Static priority is enough now. Do not use measured health or cascade yet.

## NestJS module design

- `ConfigurationModule` owns repositories and validated administrative commands.
- `RoutingModule` consumes read-only configuration and connector capabilities.
- Payment application services depend on a router port, not configuration tables.
- Use command providers for changes so audit records and validation cannot be bypassed.
- Keep configuration snapshots/version references with each routing decision for later incident analysis.

## Validation rules

- No overlapping ambiguous priority unless deliberately supported.
- Currency and method must agree with provider capability.
- Min must not exceed max.
- Credentials reference must match environment/entity/provider.
- Disabling a provider affects new routing, not historical lookup/polling/reconciliation.
- Effective-date changes cannot rewrite the configuration that an old payment used.

## Tests

- Same adapter enabled for two entities using different credentials references.
- Deposit enabled while withdrawal disabled.
- Boundary amounts at min/max.
- Unsupported currency/method/country.
- Disabled provider excluded for new requests but available to resolve old attempts.
- Misconfigured tie or missing credential rejected.
- Decision trace explains every candidate exclusion.
- Concurrent config update and routing use a coherent configuration version.

## Documentation deliverables

- ADR: configuration versus code boundary.
- ER/configuration diagram.
- Routing decision table.
- Audit-event specification for provider enable/disable and priority changes.

## Acceptance gate

- A second entity uses the same connector without code changes.
- Every route can be reconstructed from its configuration snapshot/decision trace.
- Correctness invariants remain code, not editable configuration.
- Provider disable does not prevent recovery of existing attempts.

## Questions to answer aloud

1. Why should not everything be configurable?
2. Which configuration must be snapshotted for auditability?
3. What happens to existing payments after a provider is disabled?
4. Why should connector capability and entity configuration both be checked?
5. How would an acquired entity reuse an existing integration safely?
