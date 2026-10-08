# Stage 15 — Refunds as independent financial operations

[Previous: Withdrawal saga](14-withdrawal-saga.md) | [Back to index](README.md) | [Next: Cascading](16-cascading-resilience.md)

## Outcome

Full and partial refunds have their own state, attempts, idempotency, provider evidence, and reconciliation while preserving the original payment history.

## Business reason

A refund is new money movement, not an edit that changes an original payment from succeeded to refunded. It can be asynchronous, duplicated, partially completed, rejected, or uncertain.

## Model

- Refund ID and idempotency key.
- Original payment/capture relationship.
- Requested amount/currency and provider-reported evidence.
- Requested, submitting, processing, unknown, succeeded, and failed states.
- Refund provider attempt/reference.
- Full versus partial type derived from amounts, not a fragile flag.
- Refund state history and recovery source.

## Invariants

- Only eligible externally successful payments can be refunded.
- Currency must equal original captured currency unless a documented provider model says otherwise.
- Successful plus currently reserved/in-flight refund minor units cannot exceed refundable minor units.
- Concurrent requests cannot over-refund.
- Duplicate API requests/events cannot duplicate adjustment.
- Original payment success evidence remains immutable.

## NestJS/application design

- `RefundsModule` owns controllers, use cases, repository adapters, and domain policy.
- Connector registry checks refund capability before request.
- Reservation of refundable amount and refund creation happen under a PostgreSQL concurrency strategy.
- Provider timeout becomes unknown and enters polling/reconciliation.
- Successful refund publishes an outbox event for simulated internal adjustment.
- Do not let controller derive current refundable amount from stale reads.

## Tests

- Full refund.
- Several valid partial refunds.
- Two concurrent partial refunds that would exceed total; one must fail/rescope safely.
- Duplicate idempotency key.
- Provider accepts then times out.
- Duplicate/out-of-order refund webhook.
- Unsupported provider refund capability.
- Reconciliation detects internal/provider refund drift.

## Documentation deliverables

- Refund state diagram.
- ADR: refundable-amount reservation and concurrency strategy.
- Provider capability comparison for refund semantics.
- Explanation of refund versus reversal/chargeback (even if not implemented).

## Acceptance gate

- Database/application rules prevent over-refund under concurrency.
- Original payment is not rewritten to hide its successful history.
- Unknown refunds recover through the same reliability mechanisms.
- One provider refund produces one internal adjustment.

## Questions to answer aloud

1. Why is `payment.status = REFUNDED` insufficient?
2. How do in-flight refunds affect available refundable amount?
3. Which constraint protects concurrent partial refunds?
4. How does a refund timeout differ from a definitive rejection?
5. How would reconciliation represent a provider refund missing internally?
