# Stage 16 — Safe cascading, provider health, circuit breaker, and DLQ

[Previous: Refunds](15-refunds.md) | [Back to index](README.md) | [Next: Observability](17-observability.md)

## Outcome

New eligible traffic can avoid a failing provider, while uncertain existing attempts remain protected from duplicate money movement.

## Business reason

Fallback improves availability only when the previous provider definitely did not create the operation. Cascading after an unresolved timeout can create two deposits/payouts. Circuit breakers protect dependencies but do not establish payment truth.

## Cascading eligibility

Require all:

- another configured eligible provider;
- operation/method supports multiple attempts;
- previous attempt has definitive non-success evidence;
- business policy allows another attempt;
- maximum attempts not exceeded;
- customer/action semantics remain valid;
- full audit/decision trace.

Unknown outcomes are never automatically cascaded.

## Provider health model

Measure by useful low-cardinality segments and minimum sample size:

- request latency/error category;
- payment success/decline rate;
- status latency;
- webhook delay;
- share recovered by polling;
- reconciliation mismatch rate;
- rolling window and confidence/sample count.

Do not immediately drive routing from every fluctuation. First display health, then simulate decisions, then enable conservative automatic behavior with manual override.

## Circuit breaker

Model closed, open, and half-open. Opening blocks **new** provider calls according to policy. Existing attempts still require webhook/polling/reconciliation. Separate definitive connection refusal before request transmission from ambiguous post-send timeout.

## DLQ

After bounded retry, place unprocessable asynchronous jobs/events in an inspectable DLQ with stable identifiers, error history, payload version, and replay metadata. Replay invokes the same idempotent application handler; it is not a direct database mutation.

## NestJS design

- `RoutingModule` consumes a provider-health port, not Prometheus directly.
- `ResilienceModule` may own circuit state/policy, but connectors still classify errors.
- BullMQ failed-job handling/DLQ is wrapped in explicit operational commands.
- Admin overrides require guards, reason, expiry, and audit.
- Keep third-party circuit-breaker libraries optional until you can implement/explain the state policy.

## Tests

- Definitive unavailability selects next eligible provider.
- Unknown timeout never cascades.
- Open circuit blocks new create but permits status recovery.
- Half-open probe behavior does not use a real customer money operation carelessly.
- Low sample count cannot trigger automatic routing.
- DLQ replay cannot duplicate credit/payout/refund.
- Manual provider disable and override are audited and expire as designed.

## Documentation deliverables

- ADR: safe cascade decision matrix.
- ADR: health aggregation and circuit-breaker policy.
- DLQ inspection/replay runbook.
- Incident scenario for provider outage.

## Acceptance gate

- Simulated provider outage reroutes only safe new traffic.
- Unknown transactions remain with original provider until resolved.
- Existing recovery workers continue when new traffic is blocked.
- Every fallback, breaker, and replay decision is explainable.

## Questions to answer aloud

1. What proves a failure is definitive enough to cascade?
2. How is provider request health different from payment success rate?
3. Why does an open circuit not resolve existing payments?
4. What sample-size problem can destabilize health-based routing?
5. Why must DLQ replay remain idempotent?
