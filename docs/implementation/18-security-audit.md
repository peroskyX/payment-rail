# Stage 18 — Security and audit hardening

[Previous: Observability](17-observability.md) | [Back to index](README.md) | [Next: Testing and load](19-testing-load.md)

## Outcome

Trust boundaries, access control, secrets, webhook replay protection, sensitive-data handling, and money-affecting audit evidence are explicit and tested.

## Threat model

Analyze:

- public client API;
- public provider webhook routes;
- outbound provider connections;
- admin/operations API;
- PostgreSQL and raw evidence;
- Redis/jobs;
- logs, metrics, traces;
- configuration and repair commands;
- CI/CD and developer machines.

For each, identify asset, actor, entry point, abuse case, preventive control, detective control, and recovery.

## Controls

- TLS in deployed environments.
- Authentication and role/permission guards for operations.
- Resource-level authorization by entity/customer.
- HMAC verification over exact bytes and constant-time comparison.
- Timestamp/event replay checks where provider semantics support them.
- Endpoint-specific throttling through `@nestjs/throttler`; do not block legitimate webhook bursts blindly.
- Secret lookup by provider/entity/environment and documented rotation.
- Provider keys never sent to clients or committed.
- Database/deployment encryption at rest.
- Payload allowlist/redaction and retention/deletion rules.
- Dependency/container scanning and lockfile review.
- Separate production/sandbox configuration and credentials.

## Audit model

Record actor/service, action, target, old/new safe values, reason/ticket, request/correlation/trace ID, time, entity/environment, and outcome for:

- provider enable/disable and routing changes;
- credential reference/rotation events (never secret value);
- manual repair/transition command;
- reconciliation approval/rejection;
- DLQ replay;
- circuit override;
- role/permission changes.

Audit logs should be append-oriented and harder to alter than ordinary application logs.

## NestJS design

- Guards authenticate/authorize transport calls; application services still enforce business scope.
- Decorator metadata can express permissions, but central policy providers decide them.
- Interceptors can capture safe audit context, but the application command owns reason/outcome and commits audit with state where necessary.
- Exception filters must not leak provider bodies/stacks.
- Never allow an admin controller to call repository update methods directly.

## Manual-command rule

An operator requests a command with reason/idempotency key. The command passes authorization, current-state validation, normal state machine, transaction, outbox, and audit. “Fixing” data with a direct update is outside supported operations and should require a separately controlled emergency process.

## Tests

- Invalid/missing webhook signatures.
- Replay attempts.
- Unauthorized/wrong-entity admin requests.
- Role permissions and denial logging.
- Secret/redaction scans over logs, traces, fixtures, and generated docs.
- Sandbox key cannot operate in production configuration.
- Credential reference rotates without connector-code change.
- Manual repair is idempotent and audited.

## Documentation deliverables

- Threat model.
- Data classification/retention table.
- Credential rotation runbook.
- Access-control matrix.
- Emergency manual-repair policy.

## Acceptance gate

- Security tests cover the primary trust boundaries.
- Every supported manual money-affecting operation is authorized, idempotent, state-valid, and audited.
- No known secret/sensitive field appears in observability output.
- Credential rotation requires configuration/secret change, not code.

## Questions to answer aloud

1. Why is webhook signature verification not sufficient replay protection?
2. Why must authorization also be checked in application scope?
3. Which audit records need atomicity with the business change?
4. How do you rotate one entity's provider key safely?
5. What payment data should never be logged or retained unnecessarily?
