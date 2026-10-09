import { describe, expect, it } from 'vitest';

import { Money } from '../src/domain/money/money.js';
import {
  createCanonicalError,
  createErrorEvidence,
  createPayment,
  createProviderEvidence,
  createSystemEvidence,
  isTerminalPaymentState,
  PAYMENT_STATES,
  PAYMENT_STATE_TRANSITIONS,
  transitionPayment,
  type Payment,
  type PaymentState,
  type TransitionCommand,
  type TransitionEvidence,
} from '../src/domain/payments/index.js';
import {
  IllegalStateTransitionError,
  TransitionEvidenceError,
} from '../src/domain/shared/domain-error.js';

const now = new Date('2026-10-08T12:00:00.000Z');
const later = new Date('2026-10-08T12:00:01.000Z');

function newPayment(): Payment {
  return createPayment({
    id: 'payment-1',
    merchantReference: 'merchant-order-1',
    customerId: 'customer-1',
    amount: Money.fromMinor(50_000, 'NGN'),
    requestedAt: now,
  });
}

function paymentIn(state: PaymentState): Payment {
  return Object.freeze({ ...newPayment(), state });
}

function evidenceFor(target: PaymentState): TransitionEvidence {
  if (target === 'SUBMITTING') {
    return createSystemEvidence('SUBMISSION_STARTED', now);
  }

  if (target === 'UNKNOWN') {
    return createProviderEvidence({
      attemptId: 'attempt-1',
      provider: 'good-provider',
      providerReference: 'provider-reference-1',
      rawStatus: 'undocumented_status',
      receivedAt: now,
    });
  }

  if (target === 'CREATED') {
    return createSystemEvidence('PAYMENT_CREATED', now);
  }

  return createProviderEvidence({
    attemptId: 'attempt-1',
    provider: 'good-provider',
    providerReference: 'provider-reference-1',
    rawStatus: target.toLowerCase(),
    normalizedState: target,
    occurredAt: now,
    receivedAt: later,
  });
}

function commandFor(
  target: PaymentState,
  source: TransitionCommand<PaymentState>['source'] = target === 'SUBMITTING'
    ? 'SYSTEM'
    : 'WEBHOOK',
): TransitionCommand<PaymentState> {
  return {
    to: target,
    source,
    reason: `Observed ${target}`,
    evidence: evidenceFor(target),
    processedAt: later,
  };
}

const allowedTransitions = (
  Object.entries(PAYMENT_STATE_TRANSITIONS) as [PaymentState, readonly PaymentState[]][]
).flatMap(([from, targets]) => targets.map((to) => [from, to] as const));

const forbiddenTransitions = PAYMENT_STATES.flatMap((from) =>
  PAYMENT_STATES.filter(
    (to) =>
      to !== from &&
      !PAYMENT_STATE_TRANSITIONS[from].includes(to as never) &&
      !(from === 'FAILED' && to === 'SUCCEEDED'),
  ).map((to) => [from, to] as const),
);

describe('payment state machine', () => {
  it.each(allowedTransitions)('allows %s -> %s', (from, to) => {
    const result = transitionPayment(paymentIn(from), commandFor(to));

    expect(result.kind).toBe('TRANSITIONED');
    expect(result.entity.state).toBe(to);
    expect(result.transition).toMatchObject({ from, to, entityType: 'PAYMENT' });
  });

  it.each(forbiddenTransitions)('rejects %s -> %s', (from, to) => {
    expect(() => transitionPayment(paymentIn(from), commandFor(to))).toThrow(
      IllegalStateTransitionError,
    );
  });

  it('treats repeated evidence for the current state as an idempotent no-op', () => {
    const payment = paymentIn('PROCESSING');

    const result = transitionPayment(payment, commandFor('PROCESSING'));

    expect(result).toEqual({ kind: 'NO_OP', entity: payment, transition: null });
  });

  it('never lets delayed processing evidence undo success', () => {
    expect(() => transitionPayment(paymentIn('SUCCEEDED'), commandFor('PROCESSING'))).toThrow(
      IllegalStateTransitionError,
    );
  });

  it('allows FAILED -> SUCCEEDED only for matching reconciliation evidence', () => {
    const corrected = transitionPayment(
      paymentIn('FAILED'),
      commandFor('SUCCEEDED', 'RECONCILIATION'),
    );

    expect(corrected.entity.state).toBe('SUCCEEDED');

    expect(() =>
      transitionPayment(paymentIn('FAILED'), commandFor('SUCCEEDED', 'WEBHOOK')),
    ).toThrow(IllegalStateTransitionError);

    expect(() =>
      transitionPayment(paymentIn('FAILED'), {
        ...commandFor('SUCCEEDED', 'RECONCILIATION'),
        evidence: createSystemEvidence('MANUAL_OVERRIDE', now),
      }),
    ).toThrow(TransitionEvidenceError);
  });

  it('preserves an undocumented provider status as UNKNOWN evidence', () => {
    const evidence = createProviderEvidence({
      attemptId: 'attempt-1',
      provider: 'weird-provider',
      providerReference: 'weird-ref-1',
      rawStatus: 'P01_MAYBE_DONE',
      receivedAt: now,
    });

    expect(evidence.normalizedState).toBe('UNKNOWN');
    expect(evidence.rawStatus).toBe('P01_MAYBE_DONE');
  });

  it('uses UNKNOWN_RESULT for an uncertain create response, without treating later poll failures as payment state', () => {
    const timeoutEvidence = createErrorEvidence(
      'create-payment',
      createCanonicalError({
        category: 'UNKNOWN_RESULT',
        code: 'PROVIDER_TIMEOUT',
        message: 'The create request timed out after it was sent',
      }),
      now,
    );

    const uncertain = transitionPayment(paymentIn('SUBMITTING'), {
      to: 'UNKNOWN',
      source: 'IMMEDIATE_RESPONSE',
      reason: 'The create result is uncertain',
      evidence: timeoutEvidence,
      processedAt: later,
    });
    expect(uncertain.entity.state).toBe('UNKNOWN');

    expect(() =>
      transitionPayment(paymentIn('PROCESSING'), {
        to: 'UNKNOWN',
        source: 'POLL',
        reason: 'One status poll timed out',
        evidence: timeoutEvidence,
        processedAt: later,
      }),
    ).toThrow(TransitionEvidenceError);
  });

  it('requires provider-confirmed cancellation with a provider reference', () => {
    const missingReference = createProviderEvidence({
      attemptId: 'attempt-1',
      provider: 'good-provider',
      rawStatus: 'cancelled',
      normalizedState: 'CANCELLED',
      receivedAt: now,
    });

    expect(() =>
      transitionPayment(paymentIn('PROCESSING'), {
        ...commandFor('CANCELLED'),
        evidence: missingReference,
      }),
    ).toThrow('CANCELLED requires a provider reference');
  });

  it('records provider occurrence, platform receipt, and processing separately', () => {
    const processedAt = new Date('2026-10-08T12:00:02.000Z');
    const result = transitionPayment(paymentIn('PROCESSING'), {
      ...commandFor('SUCCEEDED'),
      processedAt,
    });

    expect(result.transition?.occurredAt).toEqual(now);
    expect(result.transition?.receivedAt).toEqual(later);
    expect(result.transition?.processedAt).toEqual(processedAt);
  });

  it.each([
    ['SUCCEEDED', true],
    ['FAILED', true],
    ['CANCELLED', true],
    ['EXPIRED', true],
    ['UNKNOWN', false],
    ['PROCESSING', false],
  ] as const)('reports terminal policy for %s', (state, terminal) => {
    expect(isTerminalPaymentState(state)).toBe(terminal);
  });
});
