# Stage 12 — Reconciliation and exception management

[Previous: Outbox](11-outbox-fulfillment.md) | [Back to index](README.md) | [Next: Kora](13-kora-connector.md)

## Outcome

RailBridge independently compares internal records with provider evidence, classifies disagreements, and repairs only narrowly safe cases through normal payment workflows.

## Business reason

Even perfect application code cannot control provider databases, networks, manual provider operations, settlement/report generation, or callback delivery. Reconciliation is the financial safety net.

## Run model

A reconciliation run is bounded by provider, entity, environment, and business time/date window. Record input source/version, started/completed timestamps, totals, status, and errors.

Normalize external records, then match using stable references. Never match solely by amount.

Required item classifications:

- matched;
- status mismatch;
- amount mismatch;
- currency mismatch;
- missing internally;
- missing at provider;
- duplicate internal/provider record;
- ambiguous/unmatchable.

Record internal/external evidence, severity, proposed action, resolution status, actor/reason, and final link.

## Repair policy

A pending-to-succeeded status drift may be auto/approved repairable only when reference, amount, currency, identity metadata, and provider evidence all meet policy. Amount/currency mismatch, missing-internal money, and ambiguous matches require manual review.

Repair is a command through the existing state machine, transaction, outbox, fulfillment, audit, and idempotency path. Reconciliation never performs a direct table update.

## NestJS design

- `ReconciliationModule` has scheduler/worker, provider-source adapters, normalizer, matcher, classifier, repository, and repair-command provider.
- Connectors may normalize provider reconciliation data, but the core classifier remains provider-independent.
- Large files should stream/batch; start with bounded fixtures/API pages.
- Use deterministic run keys so rerunning the same input is idempotent.
- Keep read-only investigation queries separate from mutation commands.

## Test fixture

Build one dataset containing every classification and a late-success repair. Assert:

- correct match/classification counts;
- rerun creates no duplicate effects/exceptions;
- repair follows normal event/credit path;
- amount/currency mismatch cannot auto-credit;
- run totals equal item totals;
- partial failure can resume from checkpoints or rerun safely.

## Failure exercises

- Provider API pagination repeats or omits a page.
- Reconciliation input file is duplicated.
- Run stops halfway.
- Webhook resolves an item concurrently with reconciliation.
- Provider record timestamp falls across business-day/timezone boundary.

## Documentation deliverables

- ADR: reconciliation source of truth, window, matching, and repair policy.
- Classification/severity/action matrix.
- Operations workflow for review, approval, resolution, and evidence retention.
- Clear explanation of reconciliation versus settlement.

## Acceptance gate

- Demonstrate processing internally, provider success, mismatch, controlled repair, one credit, then matched rerun.
- Dangerous mismatches never auto-repair.
- Same input/run can be replayed safely.
- Every resolution is attributable.

## Questions to answer aloud

1. Why is reconciliation required even if polling works?
2. Why is amount-only matching dangerous?
3. Which mismatch is safe to repair automatically, if any?
4. What if webhook and reconciliation discover success simultaneously?
5. How does reconciliation differ from settlement?
