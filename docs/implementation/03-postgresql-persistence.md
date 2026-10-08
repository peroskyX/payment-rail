# Stage 3 — PostgreSQL persistence and concurrency boundary

[Previous: Domain state machines](02-domain-state-machines.md) | [Back to index](README.md) | [Next: API idempotency](04-api-idempotency.md)

## Outcome

PostgreSQL durably stores the canonical model and enforces critical relationships, uniqueness, and concurrent transition guarantees. NestJS repositories adapt database records to domain objects.

## Business reason

Two API instances or workers can act on the same payment simultaneously. In-memory checks do not coordinate them. Financial correctness must be enforced as close to the durable data as practical.

## Initial schema

Create only the tables needed now:

| Table                   | Responsibility                                                   |
| ----------------------- | ---------------------------------------------------------------- |
| `payments`              | Logical business payment and current canonical/fulfillment state |
| `payment_attempts`      | Provider-selection attempts and provider evidence                |
| `payment_state_history` | Immutable canonical transition history                           |
| `providers`             | Provider identity and environment metadata                       |
| `legal_entities`        | Business entity identity                                         |
| `payment_methods`       | Canonical method catalogue                                       |

Add inbox, outbox, idempotency, configuration, and reconciliation tables in their own stages.

## Schema decisions

- Internal IDs are independent of provider references.
- Merchant reference uniqueness has a deliberate scope.
- Provider reference uniqueness is scoped by provider and environment.
- Requested money and provider-reported money remain distinguishable.
- State version supports optimistic concurrency if chosen.
- History stores from/to state, source, reason, evidence reference, and recorded/occurred timestamps.
- Provider-specific payload evidence is outside canonical columns and follows redaction/retention rules.
- Foreign-key deletion behavior is explicit; financial history should not disappear through cascading deletes.

## NestJS design

- `DatabaseModule` owns pool creation, shutdown, and transaction infrastructure.
- Export a narrow database token/service rather than global raw access.
- Repository implementations are Nest providers inside infrastructure modules.
- Application services depend on repository ports through explicit tokens.
- Domain objects never receive Drizzle row types.
- Keep transaction ownership at the application use-case boundary when one business action spans repositories.

## Concurrency exercise

Compare and document:

- optimistic version column;
- atomic conditional update;
- `SELECT ... FOR UPDATE` row lock;
- unique constraint as race arbiter;
- transaction isolation level.

Choose a strategy for state transitions. A common approach is a transaction that loads/locks or conditionally updates the expected version, inserts immutable history, and commits both. Do not blindly lock everything; understand contention and deadlocks.

## Implementation sequence

1. Configure Drizzle and reviewed SQL migrations.
2. Add Testcontainers PostgreSQL for integration tests.
3. Implement row-to-domain mapping with explicit conversions.
4. Implement create/load and transactional transition persistence.
5. Ensure state and history are atomic.
6. Add indexes based on real planned queries: canonical ID, merchant reference, provider reference, customer/entity/status/time.
7. Add graceful pool shutdown and readiness check.
8. Inspect and save representative generated SQL in your learning notes.

## Tests

- Migrations apply to a clean database.
- Required foreign keys, checks, and unique constraints reject invalid data.
- State update and history insert roll back together.
- Two concurrent valid-looking transitions cannot both win incorrectly.
- Provider deletion/disable behavior preserves transaction history.
- Mapping round-trip preserves money and timestamps.
- Query plans use intended indexes for the primary lookup paths.

## Failure exercises

- Throw after updating current state but before history insert.
- Hold a row lock and observe another transition's behavior.
- Intentionally create a deadlock in a test/learning environment and establish consistent lock ordering.
- Submit duplicate provider references concurrently.

## Documentation deliverables

- ER diagram.
- ADR: database access and migration strategy.
- ADR: transition concurrency strategy.
- Data-retention note for provider evidence and immutable history.

## Acceptance gate

- Integration tests use real PostgreSQL rather than an in-memory substitute.
- The database rejects critical duplicate/relationship errors.
- Concurrent transitions preserve a legal single history.
- You can identify which guarantees come from domain code and which come from PostgreSQL.

## Questions to answer aloud

1. Why is a unique constraint stronger than `find` followed by `insert`?
2. When would you choose optimistic concurrency over a row lock?
3. Where should a transaction begin when several repositories participate?
4. Why keep raw provider evidence out of the canonical payment table?
5. What happens to waiting workers during a lock or deadlock?
