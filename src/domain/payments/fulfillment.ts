import type { FulfillmentState, Payment } from './payment.js';
import type { StateTransition, TransitionCommand, TransitionResult } from './transition.js';
import {
  IllegalStateTransitionError,
  PaymentInvariantError,
  TransitionEvidenceError,
} from '../shared/domain-error.js';
import { requireNonBlank, requireValidDate } from '../shared/validation.js';

const FULFILLMENT_TRANSITIONS = Object.freeze({
  NOT_STARTED: ['CREDIT_PENDING'],
  CREDIT_PENDING: ['CREDITED', 'CREDIT_FAILED'],
  CREDITED: [],
  CREDIT_FAILED: ['CREDIT_PENDING'],
} as const satisfies Record<FulfillmentState, readonly FulfillmentState[]>);

const EVIDENCE_CODES = Object.freeze({
  CREDIT_PENDING: ['CREDIT_REQUESTED', 'CREDIT_RETRY_SCHEDULED'],
  CREDITED: ['CREDIT_CONFIRMED'],
  CREDIT_FAILED: ['CREDIT_FAILED'],
  NOT_STARTED: [],
} as const satisfies Record<FulfillmentState, readonly string[]>);

export function transitionFulfillment(
  payment: Payment,
  command: TransitionCommand<FulfillmentState>,
): TransitionResult<Payment, FulfillmentState> {
  if (payment.fulfillmentState === command.to) {
    return { kind: 'NO_OP', entity: payment, transition: null };
  }

  if (!FULFILLMENT_TRANSITIONS[payment.fulfillmentState].includes(command.to as never)) {
    throw new IllegalStateTransitionError('Fulfillment', payment.fulfillmentState, command.to);
  }

  if (payment.state !== 'SUCCEEDED') {
    throw new PaymentInvariantError('Fulfillment cannot advance before payment succeeds');
  }

  if (payment.confirmedAmount === undefined || !payment.confirmedAmount.equals(payment.amount)) {
    throw new PaymentInvariantError(
      'Fulfillment requires provider-confirmed amount and currency to match the requested money',
    );
  }

  requireNonBlank(command.reason, 'reason');
  const processedAt = requireValidDate(command.processedAt, 'processedAt');

  if (
    command.evidence.kind !== 'SYSTEM' ||
    !EVIDENCE_CODES[command.to].includes(command.evidence.code as never)
  ) {
    throw new TransitionEvidenceError(
      `${command.to} requires one of: ${EVIDENCE_CODES[command.to].join(', ')}`,
    );
  }

  const transition: StateTransition<FulfillmentState> = Object.freeze({
    entityType: 'FULFILLMENT',
    entityId: payment.id,
    from: payment.fulfillmentState,
    to: command.to,
    source: command.source,
    reason: command.reason,
    evidence: command.evidence,
    occurredAt: new Date(command.evidence.occurredAt.getTime()),
    receivedAt: new Date(command.evidence.receivedAt.getTime()),
    processedAt,
  });

  const entity: Payment = Object.freeze({
    ...payment,
    fulfillmentState: command.to,
    updatedAt: new Date(processedAt.getTime()),
  });

  return { kind: 'TRANSITIONED', entity, transition };
}
