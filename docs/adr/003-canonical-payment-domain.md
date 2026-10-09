# ADR 003: Canonical payment domain and transition policy

- Status: accepted
- Date: 2026-10-08

## Context

Provider APIs use different status names and deliver facts through immediate responses, webhooks, polling, and reconciliation. A request can time out after a provider accepted it. A provider can succeed while RailBridge's internal credit fails. Duplicate and delayed observations are normal.

One mutable status string would hide these distinctions and allow old events to overwrite stronger facts.

## Decision

RailBridge uses a framework-free canonical domain with three separate concepts:

- `Payment` represents one client business intent and its current canonical external state.
- `PaymentAttempt` represents one interaction with one selected provider. Several attempts can belong to one payment, but creating another attempt will require explicit orchestration policy in a later stage.
- `FulfillmentState` represents delivery of internal value after provider success.

Payment and attempt instances use the same canonical external vocabulary: `CREATED`, `SUBMITTING`, `REQUIRES_ACTION`, `PROCESSING`, `UNKNOWN`, `SUCCEEDED`, `FAILED`, `CANCELLED`, and `EXPIRED`. They remain separate instances because an attempt's provider result and the logical payment's business outcome are different facts.

All state changes pass through explicit transition tables and return a new immutable value plus a transition description. Repeating the current target state is an idempotent no-op. Arbitrary assignment is not part of the domain API.

Every real transition requires a source, reason, evidence, provider occurrence time when available, platform receipt time, and processing time. Unknown provider statuses preserve the raw value and normalize to `UNKNOWN`.

`FAILED -> SUCCEEDED` is an exceptional correction allowed only from reconciliation with matching provider-success evidence. `SUCCEEDED` cannot regress. `CANCELLED` means provider-confirmed cancellation, not merely that RailBridge stopped waiting.

A timeout after a submitted create operation is `UNKNOWN_RESULT`, not proof of failure. A later polling timeout is an observation failure and does not by itself replace a known payment state with `UNKNOWN`.

Money is stored as a safe integer minor amount plus supported ISO currency metadata. Fulfillment cannot begin until the payment is `SUCCEEDED` and provider-confirmed money exactly matches requested amount and currency.

Canonical error classification is separate from recovery action. In particular, `UNKNOWN_RESULT` leads to provider-status verification rather than a blind retry.

## Consequences

- Delayed events cannot undo provider success or completed credit.
- Provider-specific raw statuses remain available for investigation without entering the canonical state column.
- External success and internal credit failure can coexist and recover independently.
- Adding a state requires updating exhaustive tables/tests rather than silently falling through.
- Stage 3 must persist current state and immutable history atomically and enforce concurrent version changes.
- The initial currency registry is deliberately small. Supporting another ISO currency requires reviewed metadata instead of assuming two decimal places.
- Recovery timeouts and escalation thresholds remain operational configuration for later stages; they are not hard-coded into the domain state names.

## Alternatives considered

- One `status` for provider result and fulfillment: rejected because it cannot represent externally received money with pending internal credit.
- Boolean success: rejected because asynchronous, actionable, processing, uncertain, expired, and cancelled outcomes disappear.
- Mutable entity methods with scattered conditionals: rejected because the complete transition policy becomes difficult to audit and test.
- Mapping an undocumented provider status to failure: rejected because absence of understanding is not proof of failure.
- Allowing any late event to correct failure: rejected because weak or duplicated evidence could reopen terminal outcomes.

## Review triggers

- A provider has a lifecycle that cannot be represented without losing a financially relevant distinction.
- Business policy permits late-success correction from a source other than reconciliation.
- A currency required by an enabled entity/provider is absent or its ISO minor-unit metadata changes.
- Withdrawal, refund, or reversal semantics are introduced; they must receive their own lifecycle rather than being appended casually to the deposit state machine.
