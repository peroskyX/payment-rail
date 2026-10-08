# Stage 9 — Secure webhook inbox and idempotent processing

[Previous: Paystack](08-paystack-connector.md) | [Back to index](README.md) | [Next: Polling](10-polling-retries.md)

## Outcome

Provider callbacks are authenticated using exact request bytes, durably admitted, acknowledged quickly, deduplicated, and processed asynchronously without duplicate effects.

## Business reason

Webhooks are public, untrusted, duplicateable, delayed, out of order, and lossy. Processing money directly in the controller couples provider retry behavior to every downstream failure.

## Separate admission from processing

The controller/admission provider should:

1. obtain exact raw request bytes;
2. resolve provider/environment safely;
3. verify HMAC with constant-time comparison;
4. apply timestamp/replay validation where supported;
5. validate enough envelope data to derive an identity;
6. insert an inbox record under a provider-scoped uniqueness rule;
7. return the expected acknowledgement quickly.

The asynchronous processor should:

1. claim unprocessed work safely;
2. parse it through the connector;
3. optionally verify terminal truth using provider status API;
4. validate reference, amount, and currency;
5. request a canonical transition;
6. record processed, duplicate, rejected, or retryable failure;
7. schedule only safe retries.

## Data model

Record:

- provider and environment;
- provider event ID or documented derived dedupe identity;
- payload hash and redacted evidence location;
- signature/timestamp metadata without secret;
- received time and provider occurrence time;
- processing status, attempt count, error category, and processed time;
- linked payment/attempt when resolved.

If the provider supplies no stable event ID, document the limitations of your derived key. Payload equality is not always business-event equality.

## NestJS concerns

- Enable raw-body access deliberately at bootstrap for webhook routes.
- Keep raw bytes out of ordinary logs and DTO transformation.
- Controller remains thin; signature verification is a provider-specific service/adapter concern.
- A guard may authenticate a webhook, but durable inbox insertion still belongs in an application transaction.
- Use an explicit worker provider/entry point; do not start long processing after returning an untracked response promise.
- Return provider-required acknowledgement even for a known duplicate, after signature verification and safe admission decision.

## Tests

- Valid signature over exact bytes succeeds.
- Semantically equal JSON with changed bytes fails if signature expects original bytes.
- Invalid/missing signature is rejected before persistence/processing policy as documented.
- Same event sent sequentially and concurrently produces one effective transition.
- Delayed processing after success cannot regress state.
- Processor crash after inbox insert is recoverable.
- Terminal evidence mismatch is rejected/quarantined.
- Controller acknowledgement remains within a defined latency threshold while downstream work is slow.

## Failure exercise

Send the same valid success callback 100 times concurrently. Prove:

- arrivals are counted/explainable;
- uniqueness/deduplication behaves as designed;
- one canonical success transition exists;
- no fulfillment duplication is possible once Stage 11 arrives.

## Documentation deliverables

- ADR: webhook admission, raw-body handling, authentication, dedupe, acknowledgement.
- Provider-specific signature procedure.
- Replay/deduplication threat analysis.
- Sequence diagram separating HTTP admission from worker processing.

## Acceptance gate

- Invalid signatures cannot reach business processing.
- Duplicate and out-of-order events are harmless.
- A worker crash does not lose an admitted event.
- You can explain why returning 200 quickly does not mean silently discarding the event.

## Questions to answer aloud

1. Why must signature verification sometimes use raw bytes?
2. Why is provider event dedupe different from payment fulfillment idempotency?
3. When should terminal webhook truth be verified with a status API?
4. What happens if the database is unavailable during admission?
5. Why can an old valid event still be invalid as a state transition?
