import { describe, expect, it } from 'vitest';

import { Money } from '../src/domain/money/money.js';
import {
  createPayment,
  createProviderEvidence,
  createSystemEvidence,
  transitionFulfillment,
  transitionPayment,
  type Payment,
} from '../src/domain/payments/index.js';
import {
  IllegalStateTransitionError,
  PaymentInvariantError,
} from '../src/domain/shared/domain-error.js';

const now = new Date('2026-10-08T12:00:00.000Z');

function paymentIn(
  state: Payment['state'],
  fulfillmentState: Payment['fulfillmentState'],
): Payment {
  const amount = Money.fromMinor(100_00, 'USD');
  return Object.freeze({
    ...createPayment({
      id: 'payment-1',
      merchantReference: 'order-1',
      customerId: 'customer-1',
      amount,
      requestedAt: now,
    }),
    state,
    fulfillmentState,
    ...(state === 'SUCCEEDED' ? { confirmedAmount: amount } : {}),
  });
}

describe('fulfillment state machine', () => {
  it('rejects credit work before external payment success', () => {
    expect(() =>
      transitionFulfillment(paymentIn('PROCESSING', 'NOT_STARTED'), {
        to: 'CREDIT_PENDING',
        source: 'FULFILLMENT_WORKER',
        reason: 'Queue credit work',
        evidence: createSystemEvidence('CREDIT_REQUESTED', now),
        processedAt: now,
      }),
    ).toThrow(PaymentInvariantError);
  });

  it('rejects fulfillment when provider-confirmed money is missing or different', () => {
    const withoutConfirmation = Object.freeze({
      ...paymentIn('SUCCEEDED', 'NOT_STARTED'),
      confirmedAmount: undefined,
    });
    const wrongCurrency = Object.freeze({
      ...paymentIn('SUCCEEDED', 'NOT_STARTED'),
      confirmedAmount: Money.fromMinor(100_00, 'NGN'),
    });
    const command = {
      to: 'CREDIT_PENDING' as const,
      source: 'FULFILLMENT_WORKER' as const,
      reason: 'Queue credit work',
      evidence: createSystemEvidence('CREDIT_REQUESTED', now),
      processedAt: now,
    };

    expect(() => transitionFulfillment(withoutConfirmation, command)).toThrow(
      'provider-confirmed amount and currency',
    );
    expect(() => transitionFulfillment(wrongCurrency, command)).toThrow(
      'provider-confirmed amount and currency',
    );
  });

  it('moves successful payment fulfillment through pending to credited', () => {
    const pending = transitionFulfillment(paymentIn('SUCCEEDED', 'NOT_STARTED'), {
      to: 'CREDIT_PENDING',
      source: 'FULFILLMENT_WORKER',
      reason: 'Queue credit work',
      evidence: createSystemEvidence('CREDIT_REQUESTED', now),
      processedAt: now,
    }).entity;

    const credited = transitionFulfillment(pending, {
      to: 'CREDITED',
      source: 'FULFILLMENT_WORKER',
      reason: 'Wallet confirmed one credit',
      evidence: createSystemEvidence('CREDIT_CONFIRMED', now),
      processedAt: now,
    });

    expect(credited.entity.state).toBe('SUCCEEDED');
    expect(credited.entity.fulfillmentState).toBe('CREDITED');
  });

  it('supports an explicit retry after a failed credit', () => {
    const retry = transitionFulfillment(paymentIn('SUCCEEDED', 'CREDIT_FAILED'), {
      to: 'CREDIT_PENDING',
      source: 'RECOVERY_WORKER',
      reason: 'Retry temporary wallet failure',
      evidence: createSystemEvidence('CREDIT_RETRY_SCHEDULED', now),
      processedAt: now,
    });

    expect(retry.entity.fulfillmentState).toBe('CREDIT_PENDING');
  });

  it('prevents a credited payment from regressing', () => {
    expect(() =>
      transitionFulfillment(paymentIn('SUCCEEDED', 'CREDITED'), {
        to: 'CREDIT_PENDING',
        source: 'RECOVERY_WORKER',
        reason: 'Delayed retry command',
        evidence: createSystemEvidence('CREDIT_RETRY_SCHEDULED', now),
        processedAt: now,
      }),
    ).toThrow(IllegalStateTransitionError);
  });

  it('keeps payment success separate from fulfillment success', () => {
    const payment = paymentIn('PROCESSING', 'NOT_STARTED');
    const succeeded = transitionPayment(payment, {
      to: 'SUCCEEDED',
      source: 'WEBHOOK',
      reason: 'Provider confirmed funds',
      evidence: createProviderEvidence({
        attemptId: 'attempt-1',
        provider: 'good-provider',
        providerReference: 'provider-ref-1',
        rawStatus: 'success',
        normalizedState: 'SUCCEEDED',
        reportedAmount: payment.amount,
        receivedAt: now,
      }),
      processedAt: now,
    }).entity;

    expect(succeeded.state).toBe('SUCCEEDED');
    expect(succeeded.fulfillmentState).toBe('NOT_STARTED');
    expect(succeeded.confirmedAmount?.equals(payment.amount)).toBe(true);
  });
});
