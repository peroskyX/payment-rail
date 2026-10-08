# Stage 20 — Production ownership, documentation, and final demo

[Previous: Testing and load](19-testing-load.md) | [Back to index](README.md) | [Handbook overview](../../IMPLEMENTATION_ROADMAP.md)

## Outcome

The repository demonstrates architecture judgment, operations readiness, honest evidence, and your ability to explain the system—not just implementation volume.

## Architecture records

Complete at least these ADRs:

1. Project scope and financial invariants.
2. NestJS modular monolith and domain independence.
3. Canonical payment/attempt/fulfillment state machines.
4. Money representation.
5. PostgreSQL transition concurrency.
6. API idempotency.
7. Connector and capability contract.
8. Multi-entity configuration/routing.
9. Webhook admission/processing.
10. Unknown-result and polling policy.
11. Transactional outbox/idempotent consumer.
12. Reconciliation matching/repair.
13. Withdrawal saga/compensation.
14. Refund reservation.
15. Cascading/circuit breaker.
16. Observability cardinality/redaction.

Every ADR states context, decision, alternatives, consequences, failure cases, and review trigger.

## Runbooks

Write executable runbooks for:

- provider success/latency degradation;
- webhooks stopped/delayed;
- old pending transactions;
- outbox backlog;
- reconciliation mismatch spike;
- unknown provider status;
- DLQ inspection/replay;
- suspected duplicate financial effect;
- credential rotation;
- provider disable and safe reroute;
- unknown payout outcome.

Each includes detection, impact, checks, safe actions, forbidden actions, escalation, recovery verification, and follow-up. Explicitly forbid blindly cascading unknown attempts or editing state directly.

## Simulated incident and RCA

Run a failure campaign, respond using the runbook, then write:

- summary and impact;
- detection and detailed timeline;
- root cause and contributing factors;
- safeguards that worked/failed;
- mitigation and recovery;
- corrective/preventive actions with priorities;
- links to metrics, traces, logs, payment timeline, and regression test.

## Final demo

1. Show modules/architecture and provider capability registry.
2. Show two entities sharing a connector through configuration.
3. Create an NGN test deposit through canonical API.
4. Show routing decision/config version.
5. Send success callback repeatedly; show one transition and credit.
6. Suppress another callback; show polling recovery.
7. Create provider/internal mismatch; run reconciliation and controlled repair.
8. Trigger accepted create timeout; show unknown rather than failure/cascade.
9. Trigger definitive provider failure; demonstrate eligible safe fallback.
10. Show complete operations timeline, trace, and relevant metrics.
11. Show conformance, concurrency, and load evidence.

Keep the recorded demo five to ten minutes; prepare deeper material for questions.

## README content

- Problem and why it is not a generic gateway clone.
- Architecture and invariants.
- Supported/simulated providers and methods.
- Quick start and demo.
- Failure scenarios.
- Measured results with environment.
- Security/compliance non-goals.
- Clear distinction among real sandbox calls, local simulation, and hypothetical production design.

## Interview preparation

Be able to explain without definitions-only answers:

- timeout versus failed payment;
- idempotency at API, provider, webhook, consumer, and effect levels;
- webhook versus polling versus reconciliation;
- outbox crash windows;
- safe versus unsafe cascade;
- configuration reuse across entities;
- saga compensation;
- operational signals for callback/provider problems;
- why the domain is not coupled to NestJS.

## Final acceptance gate

- Clean checkout runs the documented demo.
- ADRs/runbooks/RCA are complete and cross-linked.
- Every correctness/performance claim links to a reproducible test.
- Sandbox and simulated behavior are labeled honestly.
- You can choose any payment and explain every observation, state change, retry, job, event, and effect.
- You can prove the payment could not be credited twice.

## What to build next only after completion

- Small read-only operations UI.
- Health-aware weighted routing.
- Reconciliation-file ingestion.
- SQS/SNS replacement experiment.
- Temporal comparison for withdrawal workflow.
- Separate double-entry ledger learning project.
- AI connector-documentation assistant that proposes questions/tests but never changes money state.
