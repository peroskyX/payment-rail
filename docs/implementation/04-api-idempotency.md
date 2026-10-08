# Stage 4 — Canonical deposit API and idempotency

[Previous: PostgreSQL persistence](03-postgresql-persistence.md) | [Back to index](README.md) | [Next: Connector contract](05-connector-good-provider.md)

## Outcome

Clients can create and inspect canonical deposits through NestJS, while sequential and concurrent retries produce one logical payment.

## Business reason

Clients retry after timeouts, users double-click, gateways retransmit, and load balancers can replay requests. Payment creation must identify one logical intent independently of HTTP delivery count.

## API surface

Begin with:

- create deposit/payment;
- get payment by canonical ID;
- list payments with bounded cursor pagination and safe filters;
- get the immutable payment timeline.

Do not add withdrawals/refunds or provider-specific routes.

## NestJS responsibilities

- DTOs validate transport shape only.
- Controller extracts authenticated/scoped identity, idempotency key, and correlation context.
- Application provider coordinates idempotency, payment creation, and transaction boundary.
- Domain factory validates business invariants.
- Repository providers persist canonical state.
- Exception filter maps domain/application errors to stable HTTP responses.
- Swagger describes canonical states/errors without leaking provider vocabulary.

Avoid using an interceptor as the entire idempotency implementation. An interceptor can collect transport context, but the database transaction and semantic request comparison belong in an application service/repository.

## Idempotency record

Store:

- key;
- operation and tenant/customer/entity scope;
- deterministic semantic request hash;
- processing/completed/failed outcome policy;
- canonical payment ID;
- stable response status/body or reconstructable response reference;
- created, completed, and expiry timestamps.

Decide explicitly:

- key format and maximum length;
- scope;
- canonicalization before hashing;
- retention and reuse after expiry;
- behavior while the original request is in progress;
- which failures are replayed versus retryable;
- whether headers outside the body affect the semantic hash.

## Required behavior

| Case                                         | Result                                                                  |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| First key/request                            | Create one payment and record result atomically.                        |
| Same key and semantics                       | Return the original logical result.                                     |
| Same key, different amount/currency/customer | Idempotency conflict.                                                   |
| Simultaneous first requests                  | Database uniqueness selects one; all callers converge on it.            |
| Crash before commit                          | Neither payment nor completed idempotency result survives.              |
| Original still in progress                   | Bounded wait or documented in-progress response; never another payment. |

## Implementation sequence

1. Define DTO and canonical request mapping.
2. Define `IdempotencyModule` or a focused provider/repository; avoid coupling it only to one controller.
3. Add the table and unique scope constraint.
4. Implement deterministic canonical hashing.
5. Wrap idempotency reservation, payment creation, and response reference in a database transaction.
6. Handle the losing side of uniqueness races predictably.
7. Add Swagger documentation and examples.
8. Add list/timeline authorization boundaries even if authentication is initially simulated.

## Tests

- Same key/request sequentially returns the same canonical ID.
- Same key with changed semantic input conflicts.
- Many concurrent calls create one payment and one successful idempotency record.
- Field ordering does not change the semantic hash.
- Different customers/entities cannot accidentally share a key if scope says they should not.
- Crash injection at each transaction step leaves a valid recoverable state.
- Invalid DTO never reserves an idempotency key.

## Documentation deliverables

- ADR: idempotency scope, canonicalization, retention, and in-progress behavior.
- OpenAPI description of required header and conflict response.
- Sequence diagram for two concurrent requests.

## Acceptance gate

- The concurrency test passes repeatedly against PostgreSQL.
- No provider call exists yet; this stage protects logical creation only.
- Controllers contain no transaction or payment policy.
- You can explain API idempotency versus provider-side idempotency, webhook deduplication, and consumer idempotency.

## Questions to answer aloud

1. Why is a random client retry not necessarily the same logical request?
2. What data belongs in the semantic request hash?
3. What happens if the process dies after reserving a key?
4. Why can an HTTP interceptor alone not guarantee idempotency across instances?
5. Should validation failures be stored and replayed? Defend your policy.
