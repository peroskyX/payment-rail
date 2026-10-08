# Stage 13 — Second real connector: Kora sandbox

[Previous: Reconciliation](12-reconciliation.md) | [Back to index](README.md) | [Next: Withdrawal saga](14-withdrawal-saga.md)

## Outcome

A second, materially different provider uses the same canonical orchestration, proving that RailBridge is not a Paystack-shaped application.

## Preparation

- Obtain Kora sandbox/test access if available.
- Read current authentication, pay-in, verification, webhook, virtual account, mobile-money, payout, refund/reversal, and sandbox documentation relevant to your account.
- Inventory documented versus actually available capabilities.
- Select one method meaningfully different from the Paystack flow.
- Record sandbox limitations and any documentation ambiguities as integration risks.

If access is unavailable, complete the provider study and adapter design honestly, then use another officially documented sandbox temporarily. Never claim an integration you did not run.

## Implementation

- Authentication and environment configuration.
- Provider-specific request/response runtime validation.
- Stable merchant-reference behavior.
- Status/error normalization.
- Webhook raw-body authentication/parsing using current official rules.
- Reference/status verification and polling.
- Capability/market/currency declaration.
- Reconciliation source if officially available; otherwise declare it unsupported.
- Conformance and optional sandbox smoke tests.

## Abstraction review

For every core change Kora appears to require, classify it:

1. **Provider translation:** belongs inside Kora adapter.
2. **Capability difference:** belongs in capability/configuration model.
3. **Payment-method variation:** may belong in canonical action/evidence model.
4. **Core leak:** Paystack assumptions accidentally shaped the design.

Do not add generic abstractions until you have at least two concrete examples. Do not solve a Kora-only quirk by polluting every connector.

## Comparison document

Compare Paystack, Kora, and GoodProvider across:

- authentication and environments;
- create/reference/idempotency semantics;
- supported methods/markets;
- asynchronous statuses;
- webhook identity, signature, ordering, and retry behavior;
- verification lookup;
- timeout and error body behavior;
- refund/payout/reconciliation capability;
- sandbox limitations and known failure modes.

## Tests

- Applicable conformance suite passes.
- Unsupported capabilities fail before HTTP call.
- Unknown/new status remains safe.
- Entity enablement is configuration only.
- Same core webhook, polling, outbox, and reconciliation pathways work.
- Provider-specific fixtures remain inside connector tests.

## Documentation deliverables

- Kora provider profile and capability manifest.
- Provider comparison matrix.
- Updated connector onboarding checklist based on lessons learned.
- ADR amendment for any necessary canonical-model change.

## Acceptance gate

- Kora runs through the same canonical use case where sandbox access permits.
- No Kora conditionals exist in payment core.
- Capability differences are explicit rather than hidden failures.
- The second connector required thin translation/configuration, not a duplicated payment system.

## Questions to answer aloud

1. What assumption did the second provider challenge?
2. Which difference is translation versus business capability?
3. How do you represent methods that require customer action?
4. How do you prevent unsupported operations before contacting Kora?
5. What evidence proves the connector abstraction is useful?
