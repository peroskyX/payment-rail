import { Money } from '../../domain/money/money.js';
import type { PaymentAttempt } from '../../domain/payments/payment-attempt.js';
import type { Payment } from '../../domain/payments/payment.js';
import type { PaymentAttemptRow, PaymentRow } from '../../database/schema.js';
import type { StoredPayment, StoredPaymentAttempt } from '../application/payment.repository.js';

export function paymentRowToDomain(row: PaymentRow): StoredPayment {
  const confirmedAmount =
    row.confirmedAmountMinor === null || row.confirmedCurrency === null
      ? undefined
      : Money.fromMinor(row.confirmedAmountMinor, row.confirmedCurrency);

  const payment: Payment = Object.freeze({
    id: row.id,
    merchantReference: row.merchantReference,
    customerId: row.customerId,
    amount: Money.fromMinor(row.requestedAmountMinor, row.requestedCurrency),
    state: row.state,
    fulfillmentState: row.fulfillmentState,
    ...(confirmedAmount === undefined ? {} : { confirmedAmount }),
    requestedAt: new Date(row.requestedAt.getTime()),
    updatedAt: new Date(row.updatedAt.getTime()),
  });

  return Object.freeze({
    payment,
    legalEntityId: row.legalEntityId,
    paymentMethodId: row.paymentMethodId,
    version: row.version,
  });
}

export function paymentAttemptRowToDomain(
  row: PaymentAttemptRow,
  providerCode: string,
): StoredPaymentAttempt {
  const reportedAmount =
    row.reportedAmountMinor === null || row.reportedCurrency === null
      ? undefined
      : Money.fromMinor(row.reportedAmountMinor, row.reportedCurrency);

  const attempt: PaymentAttempt = Object.freeze({
    id: row.id,
    paymentId: row.paymentId,
    provider: providerCode,
    sequence: row.sequence,
    state: row.state,
    ...(row.providerReference === null ? {} : { providerReference: row.providerReference }),
    ...(reportedAmount === undefined ? {} : { reportedAmount }),
    createdAt: new Date(row.createdAt.getTime()),
    updatedAt: new Date(row.updatedAt.getTime()),
  });

  return Object.freeze({ attempt, providerId: row.providerId, version: row.version });
}
