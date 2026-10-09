import { requireNonBlank, requireValidDate } from '../shared/validation.js';
import { PaymentInvariantError } from '../shared/domain-error.js';
import type { Money } from '../money/money.js';
import type { PaymentAttemptState } from './payment-state.js';
import { assertPaymentTransitionAllowed } from './payment-transition-policy.js';
import type { StateTransition, TransitionCommand, TransitionResult } from './transition.js';

export interface PaymentAttempt {
  readonly id: string;
  readonly paymentId: string;
  readonly provider: string;
  readonly sequence: number;
  readonly state: PaymentAttemptState;
  readonly providerReference?: string;
  readonly reportedAmount?: Money;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreatePaymentAttemptInput {
  readonly id: string;
  readonly paymentId: string;
  readonly provider: string;
  readonly sequence: number;
  readonly createdAt: Date;
}

export function createPaymentAttempt(input: CreatePaymentAttemptInput): PaymentAttempt {
  if (!Number.isSafeInteger(input.sequence) || input.sequence < 1) {
    throw new RangeError('Payment attempt sequence must be a positive safe integer');
  }

  const createdAt = requireValidDate(input.createdAt, 'createdAt');
  return Object.freeze({
    id: requireNonBlank(input.id, 'id'),
    paymentId: requireNonBlank(input.paymentId, 'paymentId'),
    provider: requireNonBlank(input.provider, 'provider'),
    sequence: input.sequence,
    state: 'CREATED',
    createdAt,
    updatedAt: new Date(createdAt.getTime()),
  });
}

export function transitionPaymentAttempt(
  attempt: PaymentAttempt,
  command: TransitionCommand<PaymentAttemptState>,
): TransitionResult<PaymentAttempt, PaymentAttemptState> {
  if (attempt.state === command.to) {
    return { kind: 'NO_OP', entity: attempt, transition: null };
  }

  assertPaymentTransitionAllowed('PaymentAttempt', attempt.state, command);

  if (command.evidence.kind === 'PROVIDER') {
    if (
      command.evidence.attemptId !== attempt.id ||
      command.evidence.provider !== attempt.provider
    ) {
      throw new PaymentInvariantError('Provider evidence does not belong to this payment attempt');
    }

    if (
      attempt.providerReference !== undefined &&
      command.evidence.providerReference !== undefined &&
      attempt.providerReference !== command.evidence.providerReference
    ) {
      throw new PaymentInvariantError('A payment attempt provider reference cannot change');
    }
  }
  const processedAt = requireValidDate(command.processedAt, 'processedAt');
  const occurredAt =
    command.evidence.kind === 'PROVIDER'
      ? (command.evidence.occurredAt ?? command.evidence.receivedAt)
      : command.evidence.occurredAt;

  const transition: StateTransition<PaymentAttemptState> = Object.freeze({
    entityType: 'PAYMENT_ATTEMPT',
    entityId: attempt.id,
    from: attempt.state,
    to: command.to,
    source: command.source,
    reason: command.reason,
    evidence: command.evidence,
    occurredAt: new Date(occurredAt.getTime()),
    receivedAt: new Date(command.evidence.receivedAt.getTime()),
    processedAt,
  });

  const providerReference =
    command.evidence.kind === 'PROVIDER' && command.evidence.providerReference !== undefined
      ? command.evidence.providerReference
      : attempt.providerReference;

  const entity: PaymentAttempt = Object.freeze({
    ...attempt,
    state: command.to,
    ...(providerReference === undefined ? {} : { providerReference }),
    ...(command.evidence.kind === 'PROVIDER' && command.evidence.reportedAmount !== undefined
      ? { reportedAmount: command.evidence.reportedAmount }
      : {}),
    updatedAt: new Date(processedAt.getTime()),
  });

  return { kind: 'TRANSITIONED', entity, transition };
}
