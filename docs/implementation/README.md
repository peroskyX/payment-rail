# RailBridge implementation stages

This directory is the execution handbook for RailBridge. Complete the numbered files in order.

Each stage contains:

- the business reason the capability exists;
- the technical concepts to learn;
- decisions to make before implementation;
- a bounded implementation sequence;
- tests and deliberate failure exercises;
- documentation deliverables;
- an acceptance gate;
- questions you must be able to answer without reading the code.

## Working rule

Do not mark a stage complete merely because its happy path works. A payment capability is complete only when you can:

1. demonstrate it;
2. break it intentionally;
3. recover it safely;
4. observe what happened;
5. explain the business guarantee it protects.

## Index

1. [Stage 0 — Business discovery and charter](00-business-discovery.md)
2. [Stage 1 — NestJS foundation](01-nestjs-foundation.md)
3. [Stage 2 — Canonical domain and state machines](02-domain-state-machines.md)
4. [Stage 3 — PostgreSQL persistence](03-postgresql-persistence.md)
5. [Stage 4 — API and idempotency](04-api-idempotency.md)
6. [Stage 5 — Connector contract and GoodProvider](05-connector-good-provider.md)
7. [Stage 6 — Capabilities, entities, and routing](06-configuration-routing.md)
8. [Stage 7 — ChaosPay simulator](07-chaos-provider.md)
9. [Stage 8 — Paystack connector](08-paystack-connector.md)
10. [Stage 9 — Webhook inbox](09-webhook-inbox.md)
11. [Stage 10 — Polling and retries](10-polling-retries.md)
12. [Stage 11 — Outbox and fulfillment](11-outbox-fulfillment.md)
13. [Stage 12 — Reconciliation](12-reconciliation.md)
14. [Stage 13 — Kora connector](13-kora-connector.md)
15. [Stage 14 — Withdrawal saga](14-withdrawal-saga.md)
16. [Stage 15 — Refunds](15-refunds.md)
17. [Stage 16 — Cascading and resilience](16-cascading-resilience.md)
18. [Stage 17 — Observability](17-observability.md)
19. [Stage 18 — Security and audit](18-security-audit.md)
20. [Stage 19 — Concurrency, chaos, and load](19-testing-load.md)
21. [Stage 20 — Production ownership and demo](20-production-ownership.md)

Return to the [handbook overview](../../IMPLEMENTATION_ROADMAP.md).
