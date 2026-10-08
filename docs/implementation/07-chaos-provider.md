# Stage 7 — ChaosPay provider failure simulator

[Previous: Configuration and routing](06-configuration-routing.md) | [Back to index](README.md) | [Next: Paystack](08-paystack-connector.md)

## Outcome

Provider failures can be triggered deterministically through named scenarios, giving you a laboratory for payment uncertainty before relying on external sandboxes.

## Business reason

The most dangerous integration behavior is rare and hard to reproduce: acceptance followed by timeout, duplicated/out-of-order callbacks, malformed success bodies, or provider success while internal persistence fails. Random manual testing will not build confidence.

## Simulator controls

Support named scenarios for:

- normal processing then success;
- definitive decline;
- duplicate webhook count;
- delayed webhook;
- permanently dropped webhook;
- create response delayed beyond client timeout;
- provider creates transaction, then connection/response is lost;
- HTTP 429 with retry guidance;
- transient 5xx;
- HTTP 200 with business error;
- malformed/missing response fields;
- undocumented provider status;
- success followed by delayed processing callback;
- provider amount or currency mismatch;
- refund/payout variants later.

Deterministic named scenarios are required. Probability controls can be added for load tests, but cannot replace repeatable cases.

## Architecture

Run ChaosPay as a separate local process/service. Give tests a control API available only in the test environment to configure the next request or a particular merchant reference. Sign webhooks with a separate test secret.

Do not let production RailBridge routes control provider behavior. Keep simulator administration isolated by environment/network/authentication.

## Learning sequence

1. Implement normal create/status/webhook behavior.
2. Add one failure at a time.
3. Predict RailBridge's state before running the scenario.
4. Record observed request result, provider truth, canonical state, and recovery action.
5. Turn every scenario into an automated connector/application integration test.

## Mandatory demonstrations

- Accepted-but-timed-out create produces `UNKNOWN`, never `FAILED`.
- An old processing webhook cannot regress success.
- An undocumented status is persisted as evidence and alerted.
- HTTP oddities map to canonical error categories.
- Provider amount/currency mismatch blocks fulfillment.
- Diagnostic data is available without exposing secrets.

## NestJS considerations

- Keep ChaosPay in a separate application entry point/module graph.
- Share only explicit protocol fixtures/contracts; do not import its internal state into RailBridge.
- Use shutdown hooks so delayed callbacks do not make tests hang.
- Use a test-specific module/configuration so chaos controls cannot bootstrap in a production build unnoticed.

## Documentation deliverables

- Failure catalogue containing trigger, expected state, retry/cascade safety, recovery source, and alert.
- Sequence diagrams for accepted-timeout and out-of-order callback.
- Initial incident-test report.

## Acceptance gate

- Every scenario is deterministic and automated.
- Expected provider truth is inspectable independently of RailBridge state.
- Tests distinguish request failure from operation failure.
- No unsafe create retry is hidden in HTTP infrastructure.

## Questions to answer aloud

1. Why are named scenarios more useful than randomness for integration tests?
2. Which failures are definitive versus uncertain?
3. How can a 500 still hide a successfully created payment?
4. Why must ChaosPay remain an external boundary?
5. What evidence would resolve each unknown scenario?
