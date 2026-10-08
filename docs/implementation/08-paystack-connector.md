# Stage 8 — First real connector: Paystack test mode

[Previous: ChaosPay](07-chaos-provider.md) | [Back to index](README.md) | [Next: Webhook inbox](09-webhook-inbox.md)

## Outcome

The canonical connector and runtime-validation design work against a real provider sandbox without leaking Paystack concepts into core payment logic.

## Why Paystack first

Its official documentation exposes test/live keys, asynchronous statuses, server-side verification, webhook HMAC signatures, and webhook retry behavior. These are valuable learning surfaces for the reliability architecture.

## Preparation

- Create a test account and obtain test keys.
- Read current authentication, accept-payment, verification, status, and webhook documentation.
- Record sandbox limitations.
- Choose a hosted/test or transfer-oriented flow that avoids collecting raw card data.
- Add environment-specific base URL, credential reference, timeout, and webhook secret configuration.
- Make sandbox smoke tests opt-in if provider availability would make normal CI flaky.

## Adapter work

- Map the canonical creation request to the selected Paystack operation.
- Generate/use RailBridge's stable reference according to provider constraints.
- Validate every response at runtime.
- Translate action/redirect data without making the core provider-aware.
- Implement reference-based status verification.
- Map every documented status and preserve unknown status evidence.
- Classify authentication, validation, rate limit, provider 5xx, transport timeout, and malformed-body failures.
- Redact authorization and sensitive provider fields.
- Declare only capabilities you actually implemented and tested.

## Success validation

Before terminal success can trigger internal value:

- provider/merchant reference must identify the expected attempt;
- amount minor units must match;
- currency must match;
- relevant customer/metadata must match when reliable;
- success must not have been fulfilled already.

The adapter supplies evidence. Application/domain policy decides whether it is sufficient.

## NestJS design

- Put Paystack DTOs/schemas, status maps, authentication, and adapter tests in its connector area.
- Inject typed provider configuration through a specific token/group.
- Use a dedicated outbound transport abstraction or injected fetch wrapper for testability.
- Do not inject PaystackAdapter directly into PaymentsModule; register it in the connector registry.
- Generate canonical OpenAPI through `@nestjs/swagger`; never expose provider statuses as public payment states.

## Tests

- Contract/conformance suite passes.
- Every documented status maps as intended.
- Unknown status is safe.
- Amount/currency mismatch rejects success evidence.
- Test key never appears in log snapshots.
- Mocked 401, 429, 5xx, malformed response, and timeout classifications.
- Optional real sandbox initiation and verification smoke test.

## Documentation deliverables

- Provider profile: auth, methods, statuses, references, timeouts, errors, webhooks, known sandbox limitations.
- Status mapping table with justification.
- Redaction list.
- Conformance report distinguishing mocked versus live-sandbox checks.

## Acceptance gate

- A test payment is initiated and verified through the canonical adapter.
- No raw card data is accepted/stored.
- Core modules contain no Paystack branches or DTOs.
- Claims about sandbox behavior are honest and reproducible.

## Questions to answer aloud

1. Why validate a network response when TypeScript already has a type?
2. Which Paystack status maps to which canonical state, and why?
3. Why must you verify amount and currency as well as success?
4. Which tests can be deterministic locally versus sandbox smoke tests?
5. What happens if Paystack adds a new status tomorrow?
