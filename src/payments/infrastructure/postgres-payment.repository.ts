import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';

import { DATABASE_CLIENT } from '../../database/database.constants.js';
import type { RailBridgeDatabase } from '../../database/database.types.js';
import {
  paymentAttempts,
  payments,
  paymentStateHistory,
  providers,
} from '../../database/schema.js';
import type { TransitionEvidence } from '../../domain/payments/evidence.js';
import type { PaymentAttemptState } from '../../domain/payments/payment-state.js';
import type { StateTransition } from '../../domain/payments/transition.js';
import {
  type NewStoredPayment,
  type NewStoredPaymentAttempt,
  type PaymentOrFulfillmentTransition,
  type PaymentRepository,
  type StoredPayment,
  type StoredPaymentAttempt,
} from '../application/payment.repository.js';
import {
  OptimisticConcurrencyError,
  PersistenceInvariantError,
} from '../application/persistence-errors.js';
import { paymentAttemptRowToDomain, paymentRowToDomain } from './payment.mapper.js';
import { mapPostgresError } from './postgres-error.mapper.js';

@Injectable()
export class PostgresPaymentRepository implements PaymentRepository {
  constructor(@Inject(DATABASE_CLIENT) private readonly database: RailBridgeDatabase) {}

  async createPayment(input: NewStoredPayment): Promise<StoredPayment> {
    let row: typeof payments.$inferSelect | undefined;
    try {
      [row] = await this.database
        .insert(payments)
        .values({
          id: input.payment.id,
          legalEntityId: input.legalEntityId,
          paymentMethodId: input.paymentMethodId,
          merchantReference: input.payment.merchantReference,
          customerId: input.payment.customerId,
          requestedAmountMinor: input.payment.amount.minorAmount,
          requestedCurrency: input.payment.amount.currency,
          state: input.payment.state,
          fulfillmentState: input.payment.fulfillmentState,
          requestedAt: input.payment.requestedAt,
          updatedAt: input.payment.updatedAt,
        })
        .returning();
    } catch (error) {
      throw mapPostgresError(error, 'Creating payment');
    }

    if (row === undefined) {
      throw new PersistenceInvariantError('PostgreSQL did not return the inserted payment');
    }
    return paymentRowToDomain(row);
  }

  async findPaymentById(id: string): Promise<StoredPayment | null> {
    const [row] = await this.database.select().from(payments).where(eq(payments.id, id)).limit(1);
    return row === undefined ? null : paymentRowToDomain(row);
  }

  async findPaymentByMerchantReference(
    legalEntityId: string,
    merchantReference: string,
  ): Promise<StoredPayment | null> {
    const [row] = await this.database
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.legalEntityId, legalEntityId),
          eq(payments.merchantReference, merchantReference),
        ),
      )
      .limit(1);
    return row === undefined ? null : paymentRowToDomain(row);
  }

  async savePaymentTransition(
    current: StoredPayment,
    next: StoredPayment['payment'],
    transition: PaymentOrFulfillmentTransition,
  ): Promise<StoredPayment> {
    const providerId = await this.resolveProviderId(current.payment.id, transition.evidence);

    let row: typeof payments.$inferSelect;
    try {
      row = await this.database.transaction(async (tx) => {
        const [updated] = await tx
          .update(payments)
          .set({
            state: next.state,
            fulfillmentState: next.fulfillmentState,
            confirmedAmountMinor: next.confirmedAmount?.minorAmount ?? null,
            confirmedCurrency: next.confirmedAmount?.currency ?? null,
            updatedAt: next.updatedAt,
            version: sql`${payments.version} + 1`,
          })
          .where(and(eq(payments.id, current.payment.id), eq(payments.version, current.version)))
          .returning();

        if (updated === undefined) {
          throw new OptimisticConcurrencyError('Payment', current.payment.id, current.version);
        }

        await tx
          .insert(paymentStateHistory)
          .values(this.historyValues(current.payment.id, transition, providerId));
        return updated;
      });
    } catch (error) {
      throw mapPostgresError(error, 'Saving payment transition');
    }

    return paymentRowToDomain(row);
  }

  async createAttempt(input: NewStoredPaymentAttempt): Promise<StoredPaymentAttempt> {
    const [provider] = await this.database
      .select({ code: providers.code })
      .from(providers)
      .where(eq(providers.id, input.providerId))
      .limit(1);

    if (provider === undefined || provider.code !== input.attempt.provider) {
      throw new PersistenceInvariantError('Attempt provider does not match persisted provider');
    }

    let row: typeof paymentAttempts.$inferSelect | undefined;
    try {
      [row] = await this.database
        .insert(paymentAttempts)
        .values({
          id: input.attempt.id,
          paymentId: input.attempt.paymentId,
          providerId: input.providerId,
          sequence: input.attempt.sequence,
          state: input.attempt.state,
          createdAt: input.attempt.createdAt,
          updatedAt: input.attempt.updatedAt,
        })
        .returning();
    } catch (error) {
      throw mapPostgresError(error, 'Creating payment attempt');
    }

    if (row === undefined) {
      throw new PersistenceInvariantError('PostgreSQL did not return the inserted attempt');
    }
    return paymentAttemptRowToDomain(row, provider.code);
  }

  async findAttemptById(id: string): Promise<StoredPaymentAttempt | null> {
    const [result] = await this.database
      .select({ attempt: paymentAttempts, providerCode: providers.code })
      .from(paymentAttempts)
      .innerJoin(providers, eq(paymentAttempts.providerId, providers.id))
      .where(eq(paymentAttempts.id, id))
      .limit(1);

    return result === undefined
      ? null
      : paymentAttemptRowToDomain(result.attempt, result.providerCode);
  }

  async saveAttemptTransition(
    current: StoredPaymentAttempt,
    next: StoredPaymentAttempt['attempt'],
    transition: StateTransition<PaymentAttemptState>,
  ): Promise<StoredPaymentAttempt> {
    let row: typeof paymentAttempts.$inferSelect;
    try {
      row = await this.database.transaction(async (tx) => {
        const [updated] = await tx
          .update(paymentAttempts)
          .set({
            state: next.state,
            providerReference: next.providerReference ?? null,
            reportedAmountMinor: next.reportedAmount?.minorAmount ?? null,
            reportedCurrency: next.reportedAmount?.currency ?? null,
            updatedAt: next.updatedAt,
            version: sql`${paymentAttempts.version} + 1`,
          })
          .where(
            and(
              eq(paymentAttempts.id, current.attempt.id),
              eq(paymentAttempts.version, current.version),
            ),
          )
          .returning();

        if (updated === undefined) {
          throw new OptimisticConcurrencyError(
            'PaymentAttempt',
            current.attempt.id,
            current.version,
          );
        }

        await tx
          .insert(paymentStateHistory)
          .values(this.historyValues(current.attempt.paymentId, transition, current.providerId));
        return updated;
      });
    } catch (error) {
      throw mapPostgresError(error, 'Saving payment-attempt transition');
    }

    return paymentAttemptRowToDomain(row, current.attempt.provider);
  }

  private async resolveProviderId(
    paymentId: string,
    evidence: TransitionEvidence,
  ): Promise<string | null> {
    if (evidence.kind !== 'PROVIDER') return null;

    const [result] = await this.database
      .select({ providerId: paymentAttempts.providerId, providerCode: providers.code })
      .from(paymentAttempts)
      .innerJoin(providers, eq(paymentAttempts.providerId, providers.id))
      .where(
        and(eq(paymentAttempts.id, evidence.attemptId), eq(paymentAttempts.paymentId, paymentId)),
      )
      .limit(1);

    if (result === undefined || result.providerCode !== evidence.provider) {
      throw new PersistenceInvariantError('Provider evidence is not attached to this payment');
    }
    return result.providerId;
  }

  private historyValues(
    paymentId: string,
    transition: PaymentOrFulfillmentTransition | StateTransition<PaymentAttemptState>,
    providerId: string | null,
  ): typeof paymentStateHistory.$inferInsert {
    const evidence = transition.evidence;
    const attemptId =
      transition.entityType === 'PAYMENT_ATTEMPT'
        ? transition.entityId
        : evidence.kind === 'PROVIDER'
          ? evidence.attemptId
          : null;

    return {
      paymentId,
      attemptId,
      providerId,
      entityType: transition.entityType,
      fromState: transition.from,
      toState: transition.to,
      source: transition.source,
      reason: transition.reason,
      evidenceKind: evidence.kind,
      providerReference: evidence.kind === 'PROVIDER' ? (evidence.providerReference ?? null) : null,
      providerEventId: evidence.kind === 'PROVIDER' ? (evidence.providerEventId ?? null) : null,
      providerRawStatus: evidence.kind === 'PROVIDER' ? evidence.rawStatus : null,
      systemEvidenceCode: evidence.kind === 'SYSTEM' ? evidence.code : null,
      errorCategory: evidence.kind === 'ERROR' ? evidence.error.category : null,
      errorCode: evidence.kind === 'ERROR' ? evidence.error.code : null,
      occurredAt: transition.occurredAt,
      receivedAt: transition.receivedAt,
      processedAt: transition.processedAt,
    };
  }
}
