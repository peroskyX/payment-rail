import { Inject, Injectable } from '@nestjs/common';

import { transitionFulfillment } from '../../domain/payments/fulfillment.js';
import { transitionPaymentAttempt } from '../../domain/payments/payment-attempt.js';
import { transitionPayment } from '../../domain/payments/payment.js';
import type { FulfillmentState } from '../../domain/payments/payment.js';
import type { PaymentAttemptState, PaymentState } from '../../domain/payments/payment-state.js';
import type { StateTransition, TransitionCommand } from '../../domain/payments/transition.js';
import {
  PAYMENT_REPOSITORY,
  type PaymentRepository,
  type StoredPayment,
  type StoredPaymentAttempt,
} from './payment.repository.js';
import { PersistenceEntityNotFoundError } from './persistence-errors.js';

export type PersistedTransitionResult<Record, State extends string> =
  | { readonly kind: 'NO_OP'; readonly record: Record; readonly transition: null }
  | {
      readonly kind: 'TRANSITIONED';
      readonly record: Record;
      readonly transition: StateTransition<State>;
    };

@Injectable()
export class PaymentLifecycleService {
  constructor(@Inject(PAYMENT_REPOSITORY) private readonly repository: PaymentRepository) {}

  async transitionPayment(
    id: string,
    command: TransitionCommand<PaymentState>,
  ): Promise<PersistedTransitionResult<StoredPayment, PaymentState>> {
    const current = await this.requirePayment(id);
    const result = transitionPayment(current.payment, command);

    if (result.kind === 'NO_OP') {
      return { kind: 'NO_OP', record: current, transition: null };
    }

    const record = await this.repository.savePaymentTransition(
      current,
      result.entity,
      result.transition,
    );
    return { kind: 'TRANSITIONED', record, transition: result.transition };
  }

  async transitionFulfillment(
    id: string,
    command: TransitionCommand<FulfillmentState>,
  ): Promise<PersistedTransitionResult<StoredPayment, FulfillmentState>> {
    const current = await this.requirePayment(id);
    const result = transitionFulfillment(current.payment, command);

    if (result.kind === 'NO_OP') {
      return { kind: 'NO_OP', record: current, transition: null };
    }

    const record = await this.repository.savePaymentTransition(
      current,
      result.entity,
      result.transition,
    );
    return { kind: 'TRANSITIONED', record, transition: result.transition };
  }

  async transitionAttempt(
    id: string,
    command: TransitionCommand<PaymentAttemptState>,
  ): Promise<PersistedTransitionResult<StoredPaymentAttempt, PaymentAttemptState>> {
    const current = await this.repository.findAttemptById(id);
    if (current === null) {
      throw new PersistenceEntityNotFoundError('PaymentAttempt', id);
    }

    const result = transitionPaymentAttempt(current.attempt, command);
    if (result.kind === 'NO_OP') {
      return { kind: 'NO_OP', record: current, transition: null };
    }

    const record = await this.repository.saveAttemptTransition(
      current,
      result.entity,
      result.transition,
    );
    return { kind: 'TRANSITIONED', record, transition: result.transition };
  }

  private async requirePayment(id: string): Promise<StoredPayment> {
    const current = await this.repository.findPaymentById(id);
    if (current === null) {
      throw new PersistenceEntityNotFoundError('Payment', id);
    }
    return current;
  }
}
