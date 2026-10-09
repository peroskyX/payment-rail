import type { CanonicalError } from './canonical-error.js';
import type { PaymentState } from './payment-state.js';
import type { Money } from '../money/money.js';
import { requireNonBlank, requireValidDate } from '../shared/validation.js';

export const RECOVERY_SOURCES = [
  'IMMEDIATE_RESPONSE',
  'WEBHOOK',
  'POLL',
  'RECONCILIATION',
  'MANUAL',
] as const;

export type RecoverySource = (typeof RECOVERY_SOURCES)[number];

export const TRANSITION_SOURCES = [
  'CLIENT_REQUEST',
  'SYSTEM',
  ...RECOVERY_SOURCES,
  'FULFILLMENT_WORKER',
  'RECOVERY_WORKER',
] as const;

export type TransitionSource = (typeof TRANSITION_SOURCES)[number];

export type ProviderObservedState = Exclude<PaymentState, 'CREATED' | 'SUBMITTING'>;

export interface ProviderEvidence {
  readonly kind: 'PROVIDER';
  readonly attemptId: string;
  readonly provider: string;
  readonly providerReference?: string;
  readonly providerEventId?: string;
  readonly rawStatus: string;
  readonly normalizedState: ProviderObservedState;
  readonly reportedAmount?: Money;
  readonly occurredAt?: Date;
  readonly receivedAt: Date;
}

export interface ProviderEvidenceInput {
  readonly attemptId: string;
  readonly provider: string;
  readonly providerReference?: string;
  readonly providerEventId?: string;
  readonly rawStatus: string;
  readonly normalizedState?: ProviderObservedState;
  readonly reportedAmount?: Money;
  readonly occurredAt?: Date;
  readonly receivedAt: Date;
}

export interface SystemEvidence {
  readonly kind: 'SYSTEM';
  readonly code: string;
  readonly occurredAt: Date;
  readonly receivedAt: Date;
}

export interface ErrorEvidence {
  readonly kind: 'ERROR';
  readonly operation: string;
  readonly error: CanonicalError;
  readonly occurredAt: Date;
  readonly receivedAt: Date;
}

export type TransitionEvidence = ProviderEvidence | SystemEvidence | ErrorEvidence;

export function createProviderEvidence(input: ProviderEvidenceInput): ProviderEvidence {
  return Object.freeze({
    kind: 'PROVIDER',
    attemptId: requireNonBlank(input.attemptId, 'attemptId'),
    provider: requireNonBlank(input.provider, 'provider'),
    ...(input.providerReference === undefined
      ? {}
      : { providerReference: requireNonBlank(input.providerReference, 'providerReference') }),
    ...(input.providerEventId === undefined
      ? {}
      : { providerEventId: requireNonBlank(input.providerEventId, 'providerEventId') }),
    rawStatus: requireNonBlank(input.rawStatus, 'rawStatus'),
    normalizedState: input.normalizedState ?? 'UNKNOWN',
    ...(input.reportedAmount === undefined ? {} : { reportedAmount: input.reportedAmount }),
    ...(input.occurredAt === undefined
      ? {}
      : { occurredAt: requireValidDate(input.occurredAt, 'occurredAt') }),
    receivedAt: requireValidDate(input.receivedAt, 'receivedAt'),
  });
}

export function createSystemEvidence(
  code: string,
  occurredAt: Date,
  receivedAt: Date = occurredAt,
): SystemEvidence {
  return Object.freeze({
    kind: 'SYSTEM',
    code: requireNonBlank(code, 'code'),
    occurredAt: requireValidDate(occurredAt, 'occurredAt'),
    receivedAt: requireValidDate(receivedAt, 'receivedAt'),
  });
}

export function createErrorEvidence(
  operation: string,
  error: CanonicalError,
  occurredAt: Date,
  receivedAt: Date = occurredAt,
): ErrorEvidence {
  return Object.freeze({
    kind: 'ERROR',
    operation: requireNonBlank(operation, 'operation'),
    error,
    occurredAt: requireValidDate(occurredAt, 'occurredAt'),
    receivedAt: requireValidDate(receivedAt, 'receivedAt'),
  });
}
