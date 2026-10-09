import { describe, expect, it } from 'vitest';

import {
  createPaymentAttempt,
  createProviderEvidence,
  createSystemEvidence,
  transitionPaymentAttempt,
} from '../src/domain/payments/index.js';
import { PaymentInvariantError } from '../src/domain/shared/domain-error.js';

const now = new Date('2026-10-08T12:00:00.000Z');

describe('PaymentAttempt', () => {
  it('keeps provider attempts independently identifiable under one logical payment', () => {
    const first = createPaymentAttempt({
      id: 'attempt-1',
      paymentId: 'payment-1',
      provider: 'provider-a',
      sequence: 1,
      createdAt: now,
    });
    const second = createPaymentAttempt({
      id: 'attempt-2',
      paymentId: 'payment-1',
      provider: 'provider-b',
      sequence: 2,
      createdAt: now,
    });

    expect(first.paymentId).toBe(second.paymentId);
    expect(first.id).not.toBe(second.id);
    expect(first.provider).not.toBe(second.provider);
  });

  it('captures the provider reference when evidence first supplies it', () => {
    const attempt = createPaymentAttempt({
      id: 'attempt-1',
      paymentId: 'payment-1',
      provider: 'good-provider',
      sequence: 1,
      createdAt: now,
    });
    const submitting = transitionPaymentAttempt(attempt, {
      to: 'SUBMITTING',
      source: 'SYSTEM',
      reason: 'Provider submission began',
      evidence: createSystemEvidence('SUBMISSION_STARTED', now),
      processedAt: now,
    }).entity;
    const processing = transitionPaymentAttempt(submitting, {
      to: 'PROCESSING',
      source: 'IMMEDIATE_RESPONSE',
      reason: 'Provider accepted payment',
      evidence: createProviderEvidence({
        attemptId: attempt.id,
        provider: attempt.provider,
        providerReference: 'provider-ref-1',
        rawStatus: 'pending',
        normalizedState: 'PROCESSING',
        receivedAt: now,
      }),
      processedAt: now,
    });

    expect(processing.entity.providerReference).toBe('provider-ref-1');
    expect(processing.transition?.entityType).toBe('PAYMENT_ATTEMPT');
  });

  it.each([0, -1, 1.5])('rejects invalid sequence %s', (sequence) => {
    expect(() =>
      createPaymentAttempt({
        id: 'attempt-1',
        paymentId: 'payment-1',
        provider: 'provider-a',
        sequence,
        createdAt: now,
      }),
    ).toThrow('positive safe integer');
  });

  it('rejects evidence from a different attempt or provider', () => {
    const attempt = createPaymentAttempt({
      id: 'attempt-1',
      paymentId: 'payment-1',
      provider: 'provider-a',
      sequence: 1,
      createdAt: now,
    });
    const submitting = transitionPaymentAttempt(attempt, {
      to: 'SUBMITTING',
      source: 'SYSTEM',
      reason: 'Provider submission began',
      evidence: createSystemEvidence('SUBMISSION_STARTED', now),
      processedAt: now,
    }).entity;

    expect(() =>
      transitionPaymentAttempt(submitting, {
        to: 'PROCESSING',
        source: 'WEBHOOK',
        reason: 'Misdirected webhook',
        evidence: createProviderEvidence({
          attemptId: 'attempt-2',
          provider: 'provider-b',
          providerReference: 'provider-ref-2',
          rawStatus: 'pending',
          normalizedState: 'PROCESSING',
          receivedAt: now,
        }),
        processedAt: now,
      }),
    ).toThrow(PaymentInvariantError);
  });
});
