export const PAYMENT_STATES = [
  'CREATED',
  'SUBMITTING',
  'REQUIRES_ACTION',
  'PROCESSING',
  'UNKNOWN',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
] as const;

export type PaymentState = (typeof PAYMENT_STATES)[number];
export type PaymentAttemptState = PaymentState;

export const TERMINAL_PAYMENT_STATES = [
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
] as const satisfies readonly PaymentState[];

export const PAYMENT_STATE_TRANSITIONS = Object.freeze({
  CREATED: ['SUBMITTING'],
  SUBMITTING: ['REQUIRES_ACTION', 'PROCESSING', 'UNKNOWN', 'SUCCEEDED', 'FAILED'],
  REQUIRES_ACTION: ['PROCESSING', 'UNKNOWN', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED'],
  PROCESSING: ['UNKNOWN', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED'],
  UNKNOWN: ['REQUIRES_ACTION', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED'],
  SUCCEEDED: [],
  FAILED: [],
  CANCELLED: [],
  EXPIRED: [],
} as const satisfies Record<PaymentState, readonly PaymentState[]>);

export function isTerminalPaymentState(state: PaymentState): boolean {
  return TERMINAL_PAYMENT_STATES.includes(state as (typeof TERMINAL_PAYMENT_STATES)[number]);
}
