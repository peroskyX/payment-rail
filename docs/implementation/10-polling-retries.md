# Stage 10 — Active polling, retry policy, and unknown outcomes

[Previous: Webhook inbox](09-webhook-inbox.md) | [Back to index](README.md) | [Next: Outbox](11-outbox-fulfillment.md)

## Outcome

Missing callbacks and ambiguous provider requests converge through bounded, observable status polling without unsafe create retries.

## Business reason

Webhooks can be lost. A provider can accept a create request but lose its response. Polling independently asks the provider for current truth and is safe only when lookup itself has no money-moving side effect.

## Introduce BullMQ

Add Redis, BullMQ, and `@nestjs/bullmq` now—not earlier. Use separate Nest application entry points/module composition for API and workers if practical. Queue payloads contain stable IDs and schedule metadata, never secrets or large mutable payment snapshots.

## Polling policy

Configure by provider/method:

- capability enabled;
- first poll delay;
- interval/backoff sequence and jitter;
- per-request timeout;
- maximum attempts and maximum age;
- terminal evidence rules;
- action on exhaustion;
- rate-limit handling.

Polling must stop for terminal payments and must not continue forever. Exhaustion produces an operational/reconciliation candidate.

## Retry decision matrix

| Result                         | Default action                                               |
| ------------------------------ | ------------------------------------------------------------ |
| Validation/unsupported input   | Permanent; no retry                                          |
| Authentication failure         | Stop and alert                                               |
| Rate limit                     | Back off according to provider guidance                      |
| Temporary 5xx on status lookup | Retry boundedly                                              |
| Timeout on status lookup       | Retry boundedly; lookup is read-only                         |
| Timeout on create              | Unknown; look up stable reference before any create decision |
| Definitive decline             | Finish attempt as failed                                     |
| Unknown provider status        | Preserve, alert, investigate; never guess                    |

Keep error classification in connector/domain vocabulary and retry policy in application workflow configuration.

## NestJS design

- `PollingModule` registers queues and processors.
- Producer schedules IDs after a payment enters a pollable state.
- `@Processor` worker loads current state before acting; queued data may be stale.
- Worker calls an application service, not repositories/adapters directly in an unstructured chain.
- Use stable job IDs for dedupe where helpful, but never treat queue dedupe as the sole correctness boundary.
- Register graceful worker shutdown and readiness based on Redis plus database availability.
- Use deterministic clock/scheduler abstractions in tests.

## Tests

- Dropped webhook recovered by poll.
- Accepted-timeout resolved by reference lookup without duplicate create.
- Backoff and jitter policy within expected bounds.
- Duplicate/stale polling jobs are harmless.
- Terminal payment is not polled again.
- 429 respects policy.
- Authentication failure stops and alerts.
- Exhaustion creates an operations/reconciliation item.
- Redis/worker restart resumes durable scheduled work.

## Observability seed

Record final-status source now: immediate response, webhook, poll, reconciliation, or manual. Also record poll attempts and last error. Full dashboards arrive later.

## Documentation deliverables

- ADR: polling schedule, backoff, exhaustion, and queue semantics.
- Retry decision matrix per canonical error category.
- Sequence diagram for accepted create timeout followed by lookup.
- Worker restart/runbook notes.

## Acceptance gate

- ChaosPay accepts a payment, drops callback, and polling converges correctly.
- Accepted-timeout is never automatically recreated.
- Polling ends by terminal state or explicit exhaustion.
- You can explain why BullMQ retry does not make a non-idempotent job safe.

## Questions to answer aloud

1. Why can a status GET be retryable when a create POST is not?
2. What prevents duplicate polling workers from corrupting state?
3. How do you avoid a thundering herd of polls?
4. Why retain webhooks if polling can recover status?
5. What operational action follows polling exhaustion?
