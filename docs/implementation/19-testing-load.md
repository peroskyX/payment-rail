# Stage 19 — Concurrency, chaos, and load testing

[Previous: Security](18-security-audit.md) | [Back to index](README.md) | [Next: Production ownership](20-production-ownership.md)

## Outcome

Reliability and performance claims are supported by repeatable tests that assert financial effects, not merely HTTP responses.

## Test layers

| Layer                  | Purpose                                                                     |
| ---------------------- | --------------------------------------------------------------------------- |
| Plain domain unit      | State transitions, money, mapping, routing predicates, error policy         |
| Application unit       | Use-case orchestration with fake ports, no Nest bootstrap where unnecessary |
| Nest module/controller | DTO validation, guards, filters, DI wiring, HTTP contract                   |
| Repository integration | Real PostgreSQL transactions, constraints, locks, outbox atomicity          |
| Connector conformance  | Same behavioral contract for every adapter                                  |
| Worker integration     | BullMQ retry, stale/duplicate jobs, restarts, DLQ                           |
| End-to-end             | API through simulator, webhook/poll, outbox, fulfillment                    |
| Sandbox smoke          | Small external test-mode verification, separated from deterministic CI      |
| Chaos                  | Named simulator failures                                                    |
| Load                   | k6 workload, thresholds, and correctness verification                       |

## Mandatory races

- Concurrent API requests with one idempotency key.
- Concurrent duplicate callbacks.
- Webhook and poll discover success together.
- Reconciliation and webhook discover success together.
- Multiple outbox publishers claim work.
- Multiple consumers process one event.
- Concurrent partial refunds approach the limit.
- Withdrawal finalization and compensation race.
- Config update and route selection overlap.

Assert database effect counts, histories, and invariants after each race.

## k6 workload suite

- Smoke: prove scripts and environment.
- Baseline: normal create/read traffic.
- Webhook burst: configurable duplicates/out-of-order cases.
- Poll wave: many payments age simultaneously.
- Provider degradation: increased latency/rate limit/5xx.
- Stress: find the first bottleneck.
- Soak: watch memory, pools, Redis, outbox lag, pending age, and correctness over time.

Define pass/fail thresholds before execution: error rate, p95/p99 admission latency, backlog age, and zero duplicate financial effects. HTTP success alone is insufficient.

## Test engineering rules

- Use Testcontainers for isolated PostgreSQL/Redis where appropriate.
- Control clock/randomness for deterministic backoff and provider scenarios.
- Keep provider sandboxes out of mandatory fast CI.
- Seed unique test identifiers and clean only owned test data.
- Record runtime, hardware, container versions, dataset, concurrency, duration, and configuration.
- Run invariant queries after load to find duplicate credits, invalid transitions, stranded outbox items, and unresolved runs.

## Evidence report

For every published number include:

- exact commit;
- environment/hardware;
- workload and duration;
- thresholds;
- result percentiles/errors;
- invariant/correctness results;
- bottleneck and follow-up.

Never claim millions-scale capacity from extrapolation or synthetic architecture diagrams.

## Failure-injection campaign

Combine duplicate/dropped/delayed/out-of-order callbacks, accepted timeouts, malformed bodies, temporary DB failure, Redis restart, worker crash, and provider/internal drift. Verify eventual convergence or explicit exception—not silent loss.

## Documentation deliverables

- Test strategy and coverage map to invariants.
- k6 scenarios and threshold rationale.
- Latest reproducible benchmark report.
- Failure campaign report with discovered defects and fixes.

## Acceptance gate

- Chosen dataset produces zero duplicate simulated credits/payouts/refunds.
- Every core invariant maps to at least one test.
- Load failures produce non-zero outcomes and useful diagnosis.
- Another engineer can reproduce results.

## Questions to answer aloud

1. Why can 100% HTTP success coexist with a broken payment system?
2. Which concurrency test proves exactly one credit?
3. How do open versus closed load models differ for an API?
4. Why separate sandbox smoke tests from deterministic CI?
5. What invariant queries run after a chaos/load campaign?
