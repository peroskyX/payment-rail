# Stage 17 — Observability and payment operations timeline

[Previous: Cascading](16-cascading-resilience.md) | [Back to index](README.md) | [Next: Security](18-security-audit.md)

## Outcome

An engineer can answer why a payment is pending, which source finalized it, and where a provider degradation began without guessing.

## Business reason

Payment correctness includes detection and recovery time. Logs alone do not reveal aggregate provider degradation, callback delay, outbox backlog, or reconciliation drift.

## Logs

Use structured JSON and attach when relevant:

- payment/attempt IDs and safe provider reference;
- provider, entity, operation, method, environment;
- correlation, trace, event, and job IDs;
- canonical error category and recovery source;
- state transition from/to and reason.

Redact secrets, authorization, raw card data, account identifiers, unnecessary PII, and sensitive payload fields. Prefer an allowlist for provider evidence logging.

## Metrics

Add counters/histograms/gauges for:

- payments created/finalized and status latency;
- transitions and rejected transitions;
- provider request count/duration/error category;
- webhook received/invalid/duplicate/processing delay;
- polling attempts/recoveries/exhaustion;
- pending count/age;
- outbox backlog/oldest age and consumer duplicates;
- reconciliation results by mismatch type;
- DLQ size;
- final status source.

Never label metrics with payment ID, customer ID, provider reference, idempotency key, raw error text, or other unbounded values.

## Tracing

Propagate context across controllers, idempotency, routing, provider calls, database transactions, webhook worker, polling, outbox publisher/consumer, fulfillment, and reconciliation. Instrument meaningful spans without recording secrets.

## NestJS design

- `ObservabilityModule` configures logger, metrics registry, OpenTelemetry startup, and correlation context.
- Initialize telemetry before Nest application bootstrap so startup and automatic instrumentations work.
- Use interceptors for HTTP timing/context, not payment policy.
- Worker processors create/continue trace context from safe serialized metadata.
- Domain code may emit neutral diagnostic/domain-event information through application boundaries, not call Prometheus directly.

## Operations timeline

Build a read-only view combining canonical transitions, attempts, callback arrivals, polls, reconciliation, outbox publication, consumer processing, fulfillment, config version, and manual actions. Show provider occurred time and RailBridge received/processed time separately.

## Dashboard and alerts

Dashboard: provider success, p95 request/status latency, stuck payments, webhook lag, polling recovery share, mismatch count, outbox age, DLQ.

Alerts: sudden provider degradation with minimum sample size, pending-age growth, webhook-to-poll shift, mismatch spike, old outbox item, DLQ growth, unknown status.

## Tests

- Metrics increment once for the intended semantic event.
- No high-cardinality labels.
- Redaction snapshot tests.
- Trace context survives API-to-queue-to-worker flow.
- Dropped-webhook scenario is visible in timeline, metrics, and traces.
- Alert queries fire on synthetic incident data and stay quiet on expected low volume.

## Documentation deliverables

- Metrics catalogue with type, labels, unit, and business question.
- Logging/redaction policy.
- Trace/span convention.
- Dashboard screenshots/export and alert runbook links.

## Acceptance gate

- Given one ID, you reconstruct the complete payment story.
- Given an aggregate incident, you identify provider/method/entity/time window.
- Sensitive-data and cardinality checks pass.
- You can explain what metrics, logs, and traces each contribute.

## Questions to answer aloud

1. Why is polling-recovery share a provider-health signal?
2. Why are transaction IDs dangerous metric labels?
3. Which timestamps measure webhook latency?
4. How do traces cross a BullMQ boundary?
5. Which alert detects a dual-write/outbox publication problem?
