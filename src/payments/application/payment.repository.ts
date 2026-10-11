import type { PaymentAttempt } from '../../domain/payments/payment-attempt.js';
import type { FulfillmentState, Payment } from '../../domain/payments/payment.js';
import type { PaymentAttemptState, PaymentState } from '../../domain/payments/payment-state.js';
import type { StateTransition } from '../../domain/payments/transition.js';

export const PAYMENT_REPOSITORY = Symbol('PAYMENT_REPOSITORY');

export interface StoredPayment {
  readonly payment: Payment;
  readonly legalEntityId: string;
  readonly paymentMethodId: string;
  readonly version: number;
}

export interface NewStoredPayment {
  readonly payment: Payment;
  readonly legalEntityId: string;
  readonly paymentMethodId: string;
}

export interface StoredPaymentAttempt {
  readonly attempt: PaymentAttempt;
  readonly providerId: string;
  readonly version: number;
}

export interface NewStoredPaymentAttempt {
  readonly attempt: PaymentAttempt;
  readonly providerId: string;
}

export type PaymentOrFulfillmentTransition =
  StateTransition<PaymentState> | StateTransition<FulfillmentState>;

export interface PaymentRepository {
  createPayment(input: NewStoredPayment): Promise<StoredPayment>;
  findPaymentById(id: string): Promise<StoredPayment | null>;
  findPaymentByMerchantReference(
    legalEntityId: string,
    merchantReference: string,
  ): Promise<StoredPayment | null>;
  savePaymentTransition(
    current: StoredPayment,
    next: Payment,
    transition: PaymentOrFulfillmentTransition,
  ): Promise<StoredPayment>;
  createAttempt(input: NewStoredPaymentAttempt): Promise<StoredPaymentAttempt>;
  findAttemptById(id: string): Promise<StoredPaymentAttempt | null>;
  saveAttemptTransition(
    current: StoredPaymentAttempt,
    next: PaymentAttempt,
    transition: StateTransition<PaymentAttemptState>,
  ): Promise<StoredPaymentAttempt>;
}
