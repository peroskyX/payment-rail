# Stage 14 — Withdrawal policy and compensating saga

[Previous: Kora](13-kora-connector.md) | [Back to index](README.md) | [Next: Refunds](15-refunds.md)

## Outcome

A simulated withdrawal reserves funds, creates an asynchronous payout, finalizes once, and compensates only after definitive failure.

## Business reason

Withdrawals move money out and involve balance availability, ownership/compliance policy, reservation, provider payout, and final debit. A database rollback cannot undo a provider call. Failures require durable workflow state and explicit compensation.

## Workflow

1. Authenticate and authorize customer request.
2. Evaluate simulated KYC/account/first-party-destination policies.
3. Check available simulated balance.
4. Reserve funds idempotently.
5. Route only to a payout-capable provider.
6. Create payout with a stable reference.
7. Record processing or unknown outcome.
8. Resolve through webhook/polling/reconciliation.
9. On success, finalize one debit and release reservation into completion.
10. On definitive failure, compensate by releasing reservation once.

Never release funds because a create request timed out. The payout may exist.

## Saga state

Persist durable step/status, attempt, reservation ID, provider reference/evidence, compensation state, retry counters, and timestamps. Do not rely on an in-memory chain of awaited calls.

## NestJS structure

- `WithdrawalsModule` owns API and application saga orchestration.
- Policy ports represent external compliance/account checks; use deterministic simulators.
- `FulfillmentModule` supplies reserve/finalize/release operations with idempotency keys.
- Connector registry supplies payout-capable adapter.
- BullMQ schedules durable continuation/polling; processor always reloads saga state.
- Keep compensation rules in plain domain/application policy, not queue decorators.

## Tests

- Policy failure occurs before reservation/provider contact.
- Insufficient balance never creates payout.
- Reservation and withdrawal creation are atomic where local.
- Definitive provider failure releases once.
- Unknown outcome keeps reservation until resolved.
- Success finalizes debit once under duplicate callbacks/jobs.
- Compensation command is idempotent.
- Crash after provider acceptance is recovered.
- Late success after assumed failure follows an explicit exceptional policy.

## Failure exercises

- Provider accepts payout then times out.
- Finalize debit fails temporarily after payout succeeds.
- Release compensation and late success race.
- Duplicate withdrawal API request and duplicate success event.

## Documentation deliverables

- ADR: saga durability, step semantics, and compensation triggers.
- Withdrawal state/sequence diagrams.
- Policy boundary and non-goals for real compliance.
- Runbook for unknown payout outcome.

## Acceptance gate

- Demonstrate compensated definitive failure and unresolved timeout safely.
- No payout or debit can occur twice.
- Funds are not released while provider outcome is unknown.
- You can explain why local database transactions cannot make the whole workflow atomic.

## Questions to answer aloud

1. What exactly is compensation, and why is it not rollback?
2. When is reservation released versus finalized?
3. Why are withdrawals more dangerous than deposits?
4. What happens if success arrives after compensation?
5. Which saga steps must be idempotent?
