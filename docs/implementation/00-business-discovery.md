# Stage 0 — Business discovery and project charter

[Back to stage index](README.md) | [Next: NestJS foundation](01-nestjs-foundation.md)

## Outcome

You can explain what RailBridge is protecting, which facts belong to the provider versus the platform, and why a brokerage payment system is more than a checkout API. Do not scaffold NestJS during this stage.

## Why this stage exists

Payment bugs become expensive when engineers model the HTTP request instead of the business event. A provider can accept money even when your request times out; a provider can report success while internal credit fails; a callback can be duplicated or never arrive. The model must represent these realities before code makes them harder to change.

## Study

From the supplied handbook, study business context, deposits/withdrawals, PSPs/APMs, integration styles, state machines, reconciliation, regional rails, brokerage risk, first-party funding, and invariants. From the research report, study why RailBridge is a connector/reliability platform rather than a Stripe clone.

Define these terms in your own words:

- payment, deposit, withdrawal, payout, refund, reversal;
- PSP, APM, payment method, payment rail, provider connector;
- logical payment, provider attempt, provider reference, merchant reference;
- webhook, callback, polling, reconciliation, settlement;
- external success, internal fulfillment, unknown result;
- idempotency, deduplication, compensation, eventual convergence.

## Work products

### Project charter

Write one page covering:

- the user/business problem;
- the system boundary;
- target users: client application, payments operations, provider integration engineer;
- initial deposit scope;
- later withdrawal/refund scope;
- explicit non-goals;
- test-money-only statement;
- success criteria based on guarantees rather than endpoint count.

### Four sequence diagrams

Draw these by hand or in Mermaid:

1. Deposit succeeds, webhook arrives, internal credit succeeds.
2. Provider accepts the payment but the create response is lost.
3. Provider succeeds but its webhook never reaches RailBridge.
4. Provider succeeds and RailBridge records success, but internal credit temporarily fails.

For every arrow, write which system knows the fact and whether the fact is durable.

### Truth table

Create examples for combinations such as:

| Provider truth | RailBridge payment | Fulfillment    | Interpretation                                    |
| -------------- | ------------------ | -------------- | ------------------------------------------------- |
| Processing     | Processing         | Not started    | Normal asynchronous payment                       |
| Succeeded      | Processing         | Not started    | Status drift requiring recovery                   |
| Succeeded      | Succeeded          | Credit pending | External money exists; internal effect incomplete |
| Succeeded      | Succeeded          | Credited       | Completed business outcome                        |
| Unknown        | Unknown            | Not started    | Investigate; do not retry/cascade blindly         |

### Invariants

Copy the core invariants from the main handbook, then add a short statement explaining how each could be violated. This turns abstract rules into test ideas.

## Decisions to record

- Deposit is the first operation.
- No real money or raw card data.
- Provider success and internal fulfillment use separate states.
- One logical payment can have multiple provider attempts, but only under explicit policy.
- Timeouts are uncertain outcomes unless the failed operation is provably side-effect-free.
- Reconciliation identifies disagreements; it is not synonymous with settlement.

Create ADR `000-project-scope-and-financial-invariants.md`.

## Review exercise

Explain this incident without technical jargon:

> A customer paid successfully, the provider callback was lost, the customer saw a pending deposit, polling later discovered success, and internal credit was applied exactly once.

Then explain it technically using state, evidence source, idempotency, and recovery terminology.

## Acceptance gate

- The charter, glossary, truth table, diagrams, and invariants exist.
- You can explain why an HTTP timeout is not a failed payment.
- You can explain why `SUCCEEDED` and `CREDITED` cannot be one state.
- You can name what webhooks, polling, and reconciliation each protect against.
- You have not created application code.

## Questions to answer aloud

1. What exactly does RailBridge own?
2. Which external facts can it observe but not control?
3. When does money become economically usable?
4. Why are withdrawals riskier than reversed deposits?
5. What independent evidence can correct RailBridge when its normal processing path fails?
