import type { Money } from '../money/money.js';
import { PaymentInvariantError } from '../shared/domain-error.js';
import { requireNonBlank, requireValidDate } from '../shared/validation.js';
import type { PaymentState } from './payment-state.js';
import { assertPaymentTransitionAllowed } from './payment-transition-policy.js';
import type { StateTransition, TransitionCommand, TransitionResult } from './transition.js';

export interface Payment {
  readonly id: string;
  readonly merchantReference: string;
  readonly customerId: string;
  readonly amount: Money;
  readonly state: PaymentState;
  readonly fulfillmentState: FulfillmentState;
  readonly confirmedAmount?: Money;
  readonly requestedAt: Date;
  readonly updatedAt: Date;
}

export const FULFILLMENT_STATES = [
  'NOT_STARTED',
  'CREDIT_PENDING',
  'CREDITED',
  'CREDIT_FAILED',
] as const;

export type FulfillmentState = (typeof FULFILLMENT_STATES)[number];

export interface CreatePaymentInput {
  readonly id: string;
  readonly merchantReference: string;
  readonly customerId: string;
  readonly amount: Money;
  readonly requestedAt: Date;
}

export function createPayment(input: CreatePaymentInput): Payment {
  if (!input.amount.isPositive()) {
    throw new PaymentInvariantError('Payment amount must be greater than zero');
  }

  const requestedAt = requireValidDate(input.requestedAt, 'requestedAt');
  return Object.freeze({
    id: requireNonBlank(input.id, 'id'),
    merchantReference: requireNonBlank(input.merchantReference, 'merchantReference'),
    customerId: requireNonBlank(input.customerId, 'customerId'),
    amount: input.amount,
    state: 'CREATED',
    fulfillmentState: 'NOT_STARTED',
    requestedAt,
    updatedAt: new Date(requestedAt.getTime()),
  });
}

export function transitionPayment(
  payment: Payment,
  command: TransitionCommand<PaymentState>,
): TransitionResult<Payment, PaymentState> {
  if (payment.state === command.to) {
    return { kind: 'NO_OP', entity: payment, transition: null };
  }

  assertPaymentTransitionAllowed('Payment', payment.state, command);
  const processedAt = requireValidDate(command.processedAt, 'processedAt');
  const occurredAt =
    command.evidence.kind === 'PROVIDER'
      ? (command.evidence.occurredAt ?? command.evidence.receivedAt)
      : command.evidence.occurredAt;

  const transition: StateTransition<PaymentState> = Object.freeze({
    entityType: 'PAYMENT',
    entityId: payment.id,
    from: payment.state,
    to: command.to,
    source: command.source,
    reason: command.reason,
    evidence: command.evidence,
    occurredAt: new Date(occurredAt.getTime()),
    receivedAt: new Date(command.evidence.receivedAt.getTime()),
    processedAt,
  });

  const entity: Payment = Object.freeze({
    ...payment,
    state: command.to,
    ...(command.to === 'SUCCEEDED' &&
    command.evidence.kind === 'PROVIDER' &&
    command.evidence.reportedAmount !== undefined
      ? { confirmedAmount: command.evidence.reportedAmount }
      : {}),
    updatedAt: new Date(processedAt.getTime()),
  });

  return { kind: 'TRANSITIONED', entity, transition };
}
