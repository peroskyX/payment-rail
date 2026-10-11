# ADR 005: Optimistic transition concurrency

- Status: accepted
- Date: 2026-10-09

## Context

An API response, webhook worker, poller, and reconciliation job can load the same payment state concurrently and each produce a domain-valid next state. In-memory state-machine checks do not coordinate independent processes.

RailBridge must update current state and append exactly one matching history row atomically.

## Decision

Use an integer `version` on payments and payment attempts. A transition transaction performs an atomic conditional update:

```sql
UPDATE payments
SET state = $next_state,
    version = version + 1,
    updated_at = $processed_at
WHERE id = $payment_id
  AND version = $expected_version
RETURNING *;
```

If no row returns, another transaction changed the record and the repository raises `OptimisticConcurrencyError`. If the update succeeds, the repository inserts the immutable history row in the same transaction. Any insert failure rolls back the update.

The default PostgreSQL `READ COMMITTED` isolation level is sufficient for this single-row compare-and-swap because the `UPDATE` predicate is rechecked against the latest row version while PostgreSQL obtains the row lock.

Unique constraints arbitrate merchant-reference, attempt-sequence, and provider-reference races. The application does not rely on “select first, then insert.”

## Consequences

- No database lock is held while provider-independent domain logic executes.
- Low-contention transitions remain fast.
- A losing worker must reload and re-evaluate its evidence against the new state; it must not retry the stale SQL blindly.
- State and history cannot diverge through partial commit.
- The version is persistence concurrency metadata, not a payment status.
- High contention can cause repeated conflicts; metrics and bounded retry/reload policy are needed in later worker stages.

## Alternatives considered

- `SELECT ... FOR UPDATE`: strong and useful when several decisions require a stable row inside one transaction, but it holds locks while work is performed and can increase blocking/deadlock risk.
- Serializable transactions: broader protection but more retry overhead than this single-row transition requires.
- Last-write-wins update: rejected because a delayed event could overwrite stronger evidence.
- Application mutex: rejected because it does not coordinate multiple processes or survive restarts.

## Deadlock and lock-order rule

Stage 3 transactions update one aggregate row and insert its history, so the lock graph is small. Future use cases touching multiple payments/accounts must acquire locks in a stable order (for example, ascending internal UUID) and treat PostgreSQL deadlock SQLSTATE `40P01` as a bounded retryable transaction failure.

## Review triggers

- One use case must atomically coordinate several aggregates.
- Conflict rates become operationally significant.
- A workflow requires reading several rows that must remain stable until commit.
- Outbox insertion is added to the same transition transaction.
