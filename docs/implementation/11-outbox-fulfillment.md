# Stage 11 — Transactional outbox and idempotent fulfillment

[Previous: Polling](10-polling-retries.md) | [Back to index](README.md) | [Next: Reconciliation](12-reconciliation.md)

## Outcome

Payment success and its downstream event are committed atomically, and repeated event delivery produces one simulated internal credit.

## Business reason

Updating PostgreSQL and publishing to a queue are two writes. If the database succeeds and publication fails, downstream fulfillment never learns about success. If publication repeats, a non-idempotent consumer can credit twice.

## Data model

Add:

- `outbox_events`: event ID, aggregate ID/version, type, payload/version, occurred time, publish state, attempts, last error, published time;
- `processed_events`: consumer name plus event ID uniqueness and outcome;
- `account_credits` or fulfillment effects: one unique business effect per successful deposit;
- fulfillment state/history if not already persisted separately.

## Transaction rule

The payment transition to external success, fulfillment transition to `CREDIT_PENDING`, and insertion of `payment.succeeded` outbox event occur in the same PostgreSQL transaction.

An outbox publisher claims committed unpublished rows safely, publishes, then marks them. It may publish more than once if acknowledgement/state update is lost. The consumer must tolerate this.

## NestJS structure

- `OutboxModule` owns repository, publisher worker, serialization/version registry, and metrics.
- `FulfillmentModule` owns the simulated credit use case and processed-event boundary.
- Application services request domain events/outbox writes through the current transaction rather than calling a queue in the payment transition.
- Publisher/consumer run as worker entry points with bounded concurrency and graceful shutdown.
- Avoid Nest's in-process event emitter as the durability mechanism; process-local events disappear on crash.

## Simulated fulfillment flow

1. Valid external success is committed.
2. Fulfillment becomes `CREDIT_PENDING`.
3. Outbox event is committed atomically.
4. Publisher delivers at least once.
5. Consumer transaction reserves/processes event identity.
6. One unique credit effect is recorded.
7. Fulfillment becomes `CREDITED` and history/audit are recorded.

This is not a full ledger. Document that limitation.

## Crash-window tests

- Crash before database commit: state and event both absent.
- Commit succeeds; publisher is stopped: event remains discoverable.
- Publish succeeds; publisher dies before marking: event redelivers harmlessly.
- Consumer records credit then dies before queue acknowledgement: redelivery creates no second credit.
- Two consumers race: unique effect/processed-event constraints preserve one credit.
- Event payload version unknown: quarantine/DLQ instead of guessing.

## Ordering decisions

Decide whether consumers require per-payment ordering. Do not assume global queue order. Include aggregate version and let consumers reject/defer stale or impossible events through domain policy.

## Documentation deliverables

- ADR: transactional outbox and publisher claiming.
- ADR: consumer idempotency transaction/effect ordering.
- Event catalogue with payload version and ownership.
- Diagram of every crash window and recovery.

## Acceptance gate

- Repeating `payment.succeeded` produces one simulated credit.
- A committed outbox backlog drains after publisher restart.
- There is no direct queue publish in the payment database transaction path.
- You can explain at-least-once delivery versus at-most-once financial effect.

## Questions to answer aloud

1. Which dual-write failure does the outbox remove?
2. Why can the outbox publisher still duplicate events?
3. Should processed-event recording happen before or after the financial effect?
4. What database constraint is the final duplicate-credit boundary?
5. Why is an in-memory Nest event not sufficient?
