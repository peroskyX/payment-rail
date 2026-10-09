import type { TransitionCommand } from './transition.js';
import { PAYMENT_STATE_TRANSITIONS, type PaymentState } from './payment-state.js';
import { IllegalStateTransitionError, TransitionEvidenceError } from '../shared/domain-error.js';
import { requireNonBlank, requireValidDate } from '../shared/validation.js';

export function assertPaymentTransitionAllowed(
  entity: 'Payment' | 'PaymentAttempt',
  from: PaymentState,
  command: TransitionCommand<PaymentState>,
): void {
  requireNonBlank(command.reason, 'reason');
  requireValidDate(command.processedAt, 'processedAt');

  const lateReconciledSuccess =
    from === 'FAILED' && command.to === 'SUCCEEDED' && command.source === 'RECONCILIATION';

  if (!PAYMENT_STATE_TRANSITIONS[from].includes(command.to as never) && !lateReconciledSuccess) {
    throw new IllegalStateTransitionError(entity, from, command.to);
  }

  assertEvidenceSupports(from, command.to, command);

  if (lateReconciledSuccess && command.evidence.kind !== 'PROVIDER') {
    throw new TransitionEvidenceError('Late reconciled success requires provider evidence');
  }
}

function assertEvidenceSupports(
  from: PaymentState,
  target: PaymentState,
  command: TransitionCommand<PaymentState>,
): void {
  const { evidence } = command;

  if (target === 'SUBMITTING') {
    if (
      command.source !== 'SYSTEM' ||
      evidence.kind !== 'SYSTEM' ||
      evidence.code !== 'SUBMISSION_STARTED'
    ) {
      throw new TransitionEvidenceError('SUBMITTING requires SUBMISSION_STARTED system evidence');
    }
    return;
  }

  if (target === 'UNKNOWN') {
    const providerUnknown = evidence.kind === 'PROVIDER' && evidence.normalizedState === 'UNKNOWN';
    const uncertainCreateResult =
      from === 'SUBMITTING' &&
      command.source === 'IMMEDIATE_RESPONSE' &&
      evidence.kind === 'ERROR' &&
      evidence.error.category === 'UNKNOWN_RESULT';
    if (!providerUnknown && !uncertainCreateResult) {
      throw new TransitionEvidenceError(
        'UNKNOWN requires unknown provider evidence or an UNKNOWN_RESULT error',
      );
    }
    return;
  }

  if (target === 'FAILED' && evidence.kind === 'ERROR') {
    if (
      from !== 'SUBMITTING' ||
      command.source !== 'IMMEDIATE_RESPONSE' ||
      !['VALIDATION', 'AUTHENTICATION', 'PERMANENT'].includes(evidence.error.category)
    ) {
      throw new TransitionEvidenceError('FAILED error evidence must describe a definitive error');
    }
    return;
  }

  if (evidence.kind !== 'PROVIDER' || evidence.normalizedState !== target) {
    throw new TransitionEvidenceError(`${target} requires matching provider evidence`);
  }

  if (
    !['IMMEDIATE_RESPONSE', 'WEBHOOK', 'POLL', 'RECONCILIATION', 'MANUAL'].includes(command.source)
  ) {
    throw new TransitionEvidenceError('Provider evidence requires a provider-observation source');
  }

  if (
    ['SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED'].includes(target) &&
    evidence.providerReference === undefined
  ) {
    throw new TransitionEvidenceError(`${target} requires a provider reference`);
  }
}
