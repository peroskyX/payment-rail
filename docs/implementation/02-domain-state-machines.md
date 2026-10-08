# Stage 2 — Canonical domain model and state machines

[Previous: NestJS foundation](01-nestjs-foundation.md) | [Back to index](README.md) | [Next: PostgreSQL persistence](03-postgresql-persistence.md)

## Outcome

Framework-free TypeScript models express payment truth, provider attempts, fulfillment, money, errors, and legal transitions. Tests run without booting NestJS.

## Business reason

Payments evolve asynchronously. A boolean or arbitrary status string cannot represent submission, customer action, processing, uncertain outcome, external success, and incomplete internal credit. State machines make acceptable evidence and recovery behavior explicit.

## Domain vocabulary

Model at least:

- `Money`: integer minor units plus ISO currency;
- `Payment`: one client business intent;
- `PaymentAttempt`: one selected provider interaction;
- `PaymentState`: canonical external lifecycle;
- `FulfillmentState`: internal value-delivery lifecycle;
- `Transition`: from, to, source, reason, evidence, occurrence time;
- `ProviderEvidence`: raw status/reference and normalized observation;
- `CanonicalError`: validation, authentication, rate limit, temporary, permanent, unknown result;
- `RecoverySource`: immediate response, webhook, poll, reconciliation, manual.

Use integer minor units and currency metadata. Do not use JavaScript floating point for money. Do not assume every currency has two decimal places.

## State design workshop

Start with payment states such as:

- `CREATED`;
- `SUBMITTING`;
- `REQUIRES_ACTION`;
- `PROCESSING`;
- `UNKNOWN`;
- `SUCCEEDED`;
- `FAILED`;
- `CANCELLED`;
- `EXPIRED`.

Keep fulfillment separate:

- `NOT_STARTED`;
- `CREDIT_PENDING`;
- `CREDITED`;
- `CREDIT_FAILED`.

For every state, document:

- its business meaning;
- whether it is terminal;
- which actor/evidence can enter it;
- allowed next states;
- operational timeout/attention policy;
- whether customer-visible wording differs from the internal name.

## Decisions before implementation

- Does `FAILED -> SUCCEEDED` ever occur after late provider evidence? If yes, define a narrow policy rather than allowing it generally.
- Does cancellation mean RailBridge stopped waiting, or that the provider proved cancellation?
- Is `UNKNOWN` a payment state, an attempt state, or both? Explain the scope.
- What happens when an adapter returns an undocumented provider status?
- Which timestamps mean request time, provider occurrence time, receipt time, and processing time?

## Implementation sequence

1. Create plain TypeScript types/classes without Nest imports.
2. Implement money construction/comparison rules.
3. Define transition tables explicitly rather than scattered conditionals.
4. Make the transition function return a new state/result plus transition record description; do not persist here.
5. Require transition source and evidence.
6. Reject illegal transitions with domain errors, not HTTP exceptions.
7. Define canonical error classification separately from retry policy; one describes the error, the other decides a workflow action.
8. Add exhaustive status handling so a new enum/union case causes a compile or test failure.

## Tests

- Every allowed transition.
- Every forbidden transition.
- Terminal-state regression after an old event.
- Late success policy after recorded failure.
- Unknown provider state remains unknown evidence.
- Money equality checks minor units and currency.
- Invalid/unsupported currency metadata.
- Fulfillment cannot become credited before payment success evidence.
- Duplicate request for the same target state is either a documented no-op or rejection.

Use table-driven tests so the transition policy is readable as a specification.

## Nest integration boundary

Later, an application provider will load a payment, call this domain policy, and persist the result. The domain never injects a repository and never knows about a controller, DTO, database row, or queue.

## Documentation deliverables

- ADR: canonical payment/attempt/fulfillment model.
- State diagram and transition matrix.
- Money representation note including zero- and non-two-decimal currencies.
- Error taxonomy with examples and non-examples.

## Acceptance gate

- All domain tests run without `TestingModule` or Nest startup.
- Every terminal transition names its required evidence.
- Adding an unknown status cannot silently become success, failure, or processing.
- You can explain why payment, attempt, and fulfillment are separate aggregates/concepts.

## Questions to answer aloud

1. Why is `UNKNOWN` safer than mapping a timeout to `FAILED`?
2. Can a payment have multiple attempts while remaining one logical payment?
3. What is the difference between error classification and retry policy?
4. Why is a refund not simply another original-payment state?
5. Which rule prevents a delayed event from undoing success?
