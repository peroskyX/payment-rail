import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { and, count, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { DatabaseService } from '../../src/database/database.service.js';
import * as schema from '../../src/database/schema.js';
import {
  legalEntities,
  paymentMethods,
  payments,
  paymentStateHistory,
  providers,
} from '../../src/database/schema.js';
import type { RailBridgeDatabase } from '../../src/database/database.types.js';
import { Money } from '../../src/domain/money/money.js';
import {
  createPayment,
  createPaymentAttempt,
  createProviderEvidence,
  createSystemEvidence,
  transitionPayment,
  transitionPaymentAttempt,
  type Payment,
} from '../../src/domain/payments/index.js';
import {
  OptimisticConcurrencyError,
  PersistenceConflictError,
} from '../../src/payments/application/persistence-errors.js';
import type {
  StoredPayment,
  StoredPaymentAttempt,
} from '../../src/payments/application/payment.repository.js';
import { PostgresPaymentRepository } from '../../src/payments/infrastructure/postgres-payment.repository.js';

const postgresImage = 'postgres:18-alpine';
const now = new Date('2026-10-09T10:00:00.000Z');

interface FixtureIds {
  legalEntityId: string;
  otherLegalEntityId: string;
  paymentMethodId: string;
  providerId: string;
  otherProviderId: string;
}

describe('PostgresPaymentRepository', () => {
  let container: StartedPostgreSqlContainer | undefined;
  let pool: Pool | undefined;
  let database: RailBridgeDatabase;
  let repository: PostgresPaymentRepository;
  let fixture: FixtureIds;

  beforeAll(async () => {
    container = await new PostgreSqlContainer(postgresImage).start();
    pool = new Pool({ connectionString: container.getConnectionUri() });
    database = drizzle({ client: pool, schema });
    await migrate(database, { migrationsFolder: resolve(process.cwd(), 'drizzle') });
    repository = new PostgresPaymentRepository(database);
  });

  afterAll(async () => {
    if (pool !== undefined) await pool.end();
    if (container !== undefined) await container.stop();
  });

  beforeEach(async () => {
    await requirePool().query(
      'TRUNCATE payment_state_history, payment_attempts, payments, providers, payment_methods, legal_entities RESTART IDENTITY CASCADE',
    );
    fixture = await seedReferenceData(database);
  });

  it('applies migrations to a clean real PostgreSQL database and passes schema readiness', async () => {
    const result = await requirePool().query<{ payments: string | null; history: string | null }>(
      `SELECT to_regclass('public.payments')::text AS payments,
              to_regclass('public.payment_state_history')::text AS history`,
    );

    expect(result.rows[0]).toEqual({
      payments: 'payments',
      history: 'payment_state_history',
    });

    const databaseService = new DatabaseService(requirePool());
    await expect(databaseService.checkReadiness(1_000)).resolves.toBeUndefined();
  });

  it('round-trips payment money, ownership, state, version, and timestamps', async () => {
    const payment = newPayment('merchant-round-trip');
    const created = await repository.createPayment({
      payment,
      legalEntityId: fixture.legalEntityId,
      paymentMethodId: fixture.paymentMethodId,
    });
    const loaded = await repository.findPaymentById(payment.id);

    expect(created.version).toBe(0);
    expect(loaded).not.toBeNull();
    expect(loaded?.legalEntityId).toBe(fixture.legalEntityId);
    expect(loaded?.paymentMethodId).toBe(fixture.paymentMethodId);
    expect(loaded?.payment.amount.equals(payment.amount)).toBe(true);
    expect(loaded?.payment.requestedAt).toEqual(now);
    expect(loaded?.payment.state).toBe('CREATED');
  });

  it('scopes merchant-reference uniqueness to a legal entity', async () => {
    const reference = 'entity-scoped-reference';
    await repository.createPayment({
      payment: newPayment(reference),
      legalEntityId: fixture.legalEntityId,
      paymentMethodId: fixture.paymentMethodId,
    });

    await expect(
      repository.createPayment({
        payment: newPayment(reference),
        legalEntityId: fixture.legalEntityId,
        paymentMethodId: fixture.paymentMethodId,
      }),
    ).rejects.toBeInstanceOf(PersistenceConflictError);

    await expect(
      repository.createPayment({
        payment: newPayment(reference),
        legalEntityId: fixture.otherLegalEntityId,
        paymentMethodId: fixture.paymentMethodId,
      }),
    ).resolves.toMatchObject({ version: 0 });
  });

  it('lets PostgreSQL reject invalid money and unsupported currency', async () => {
    const base = {
      id: randomUUID(),
      legalEntityId: fixture.legalEntityId,
      paymentMethodId: fixture.paymentMethodId,
      merchantReference: 'invalid-money',
      customerId: 'customer-1',
      requestedAmountMinor: 0,
      requestedCurrency: 'USD',
      requestedAt: now,
      updatedAt: now,
    };

    await expectPostgresCode(database.insert(payments).values(base), '23514');
    await expectPostgresCode(
      database.insert(payments).values({
        ...base,
        id: randomUUID(),
        merchantReference: 'unsupported-currency',
        requestedAmountMinor: 100,
        requestedCurrency: 'BTC',
      }),
      '23514',
    );
  });

  it('atomically updates current state and appends immutable history', async () => {
    const current = await persistPayment('atomic-transition');
    const domainResult = transitionPayment(current.payment, {
      to: 'SUBMITTING',
      source: 'SYSTEM',
      reason: 'Begin provider submission',
      evidence: createSystemEvidence('SUBMISSION_STARTED', now),
      processedAt: now,
    });
    expect(domainResult.kind).toBe('TRANSITIONED');
    if (domainResult.kind !== 'TRANSITIONED') return;

    const updated = await repository.savePaymentTransition(
      current,
      domainResult.entity,
      domainResult.transition,
    );
    const history = await database
      .select()
      .from(paymentStateHistory)
      .where(eq(paymentStateHistory.paymentId, current.payment.id));

    expect(updated.payment.state).toBe('SUBMITTING');
    expect(updated.version).toBe(1);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      fromState: 'CREATED',
      toState: 'SUBMITTING',
      systemEvidenceCode: 'SUBMISSION_STARTED',
    });

    await expectPostgresCode(
      database
        .update(paymentStateHistory)
        .set({ reason: 'history must not change' })
        .where(eq(paymentStateHistory.id, history[0]!.id)),
      'P0001',
    );
    await expectPostgresCode(
      database.delete(paymentStateHistory).where(eq(paymentStateHistory.id, history[0]!.id)),
      'P0001',
    );
  });

  it('rolls back a state update when its history insert fails', async () => {
    const current = await persistPayment('rollback-together');

    await expectPostgresCode(
      database.transaction(async (tx) => {
        await tx
          .update(payments)
          .set({ state: 'FAILED', version: 1 })
          .where(eq(payments.id, current.payment.id));
        await tx.insert(paymentStateHistory).values({
          paymentId: current.payment.id,
          entityType: 'PAYMENT',
          fromState: 'CREATED',
          toState: 'FAILED',
          source: 'SYSTEM',
          reason: 'Deliberately invalid evidence shape',
          evidenceKind: 'SYSTEM',
          systemEvidenceCode: null,
          occurredAt: now,
          receivedAt: now,
          processedAt: now,
        });
      }),
      '23514',
    );

    const unchanged = await repository.findPaymentById(current.payment.id);
    const [historyCountRow] = await database
      .select({ value: count() })
      .from(paymentStateHistory)
      .where(eq(paymentStateHistory.paymentId, current.payment.id));

    expect(unchanged?.payment.state).toBe('CREATED');
    expect(unchanged?.version).toBe(0);
    expect(historyCountRow?.value).toBe(0);
  });

  it('allows only one incompatible concurrent transition from the same version', async () => {
    const { payment: processing, attempt } = await persistProcessingPayment();
    const succeeded = transitionPayment(processing.payment, {
      to: 'SUCCEEDED',
      source: 'WEBHOOK',
      reason: 'Provider success event',
      evidence: providerEvidence(attempt, 'SUCCEEDED', 'success'),
      processedAt: new Date(now.getTime() + 2_000),
    });
    const failed = transitionPayment(processing.payment, {
      to: 'FAILED',
      source: 'POLL',
      reason: 'Provider failure observation',
      evidence: providerEvidence(attempt, 'FAILED', 'failed'),
      processedAt: new Date(now.getTime() + 2_000),
    });
    if (succeeded.kind !== 'TRANSITIONED' || failed.kind !== 'TRANSITIONED') return;

    const results = await Promise.allSettled([
      repository.savePaymentTransition(processing, succeeded.entity, succeeded.transition),
      repository.savePaymentTransition(processing, failed.entity, failed.transition),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected?.status).toBe('rejected');
    if (rejected?.status !== 'rejected') throw new Error('Expected one rejected transition');
    expect(rejected.reason).toBeInstanceOf(OptimisticConcurrencyError);

    const final = await repository.findPaymentById(processing.payment.id);
    const [terminalHistoryCountRow] = await database
      .select({ value: count() })
      .from(paymentStateHistory)
      .where(
        and(
          eq(paymentStateHistory.paymentId, processing.payment.id),
          eq(paymentStateHistory.fromState, 'PROCESSING'),
        ),
      );

    expect(['SUCCEEDED', 'FAILED']).toContain(final?.payment.state);
    expect(final?.version).toBe(processing.version + 1);
    expect(terminalHistoryCountRow?.value).toBe(1);
  });

  it('scopes provider-reference uniqueness by provider identity', async () => {
    const firstPayment = await persistPayment('provider-reference-1');
    const secondPayment = await persistPayment('provider-reference-2');
    const thirdPayment = await persistPayment('provider-reference-3');
    const first = await persistAttempt(firstPayment, fixture.providerId, 'good-provider', 1);
    const second = await persistAttempt(secondPayment, fixture.providerId, 'good-provider', 1);
    const third = await persistAttempt(thirdPayment, fixture.otherProviderId, 'other-provider', 1);

    await moveAttemptToProcessing(first, 'shared-provider-reference');
    await expect(
      moveAttemptToProcessing(second, 'shared-provider-reference'),
    ).rejects.toBeInstanceOf(PersistenceConflictError);
    await expect(
      moveAttemptToProcessing(third, 'shared-provider-reference'),
    ).resolves.toMatchObject({
      attempt: { providerReference: 'shared-provider-reference' },
    });
  });

  it('prevents provider deletion while financial records exist but allows disabling it', async () => {
    const payment = await persistPayment('provider-retention');
    await persistAttempt(payment, fixture.providerId, 'good-provider', 1);

    await expectPostgresCode(
      database.delete(providers).where(eq(providers.id, fixture.providerId)),
      '23001',
    );
    await database
      .update(providers)
      .set({ enabled: false, updatedAt: new Date(now.getTime() + 1_000) })
      .where(eq(providers.id, fixture.providerId));

    const [provider] = await database
      .select({ enabled: providers.enabled })
      .from(providers)
      .where(eq(providers.id, fixture.providerId));
    expect(provider?.enabled).toBe(false);
  });

  it('uses the entity/state/time index for the operational payment query', async () => {
    const client = await requirePool().connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL enable_seqscan = off');
      const plan = await client.query<{ 'QUERY PLAN': string }>(
        `EXPLAIN SELECT id
           FROM payments
          WHERE legal_entity_id = $1 AND state = 'PROCESSING'
          ORDER BY requested_at`,
        [fixture.legalEntityId],
      );
      expect(plan.rows.map((row) => row['QUERY PLAN']).join('\n')).toContain(
        'payments_entity_state_requested_at_idx',
      );
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  async function persistPayment(reference: string): Promise<StoredPayment> {
    return repository.createPayment({
      payment: newPayment(reference),
      legalEntityId: fixture.legalEntityId,
      paymentMethodId: fixture.paymentMethodId,
    });
  }

  function requirePool(): Pool {
    if (pool === undefined) throw new Error('PostgreSQL test pool is not initialized');
    return pool;
  }

  async function persistAttempt(
    payment: StoredPayment,
    providerId: string,
    providerCode: string,
    sequence: number,
  ): Promise<StoredPaymentAttempt> {
    return repository.createAttempt({
      providerId,
      attempt: createPaymentAttempt({
        id: randomUUID(),
        paymentId: payment.payment.id,
        provider: providerCode,
        sequence,
        createdAt: now,
      }),
    });
  }

  async function moveAttemptToProcessing(
    initial: StoredPaymentAttempt,
    providerReference: string,
  ): Promise<StoredPaymentAttempt> {
    const submitting = transitionPaymentAttempt(initial.attempt, {
      to: 'SUBMITTING',
      source: 'SYSTEM',
      reason: 'Submission started',
      evidence: createSystemEvidence('SUBMISSION_STARTED', now),
      processedAt: now,
    });
    if (submitting.kind !== 'TRANSITIONED') throw new Error('Expected attempt transition');
    const storedSubmitting = await repository.saveAttemptTransition(
      initial,
      submitting.entity,
      submitting.transition,
    );
    const processing = transitionPaymentAttempt(storedSubmitting.attempt, {
      to: 'PROCESSING',
      source: 'IMMEDIATE_RESPONSE',
      reason: 'Provider accepted payment',
      evidence: createProviderEvidence({
        attemptId: initial.attempt.id,
        provider: initial.attempt.provider,
        providerReference,
        rawStatus: 'pending',
        normalizedState: 'PROCESSING',
        receivedAt: now,
      }),
      processedAt: now,
    });
    if (processing.kind !== 'TRANSITIONED') throw new Error('Expected attempt transition');
    return repository.saveAttemptTransition(
      storedSubmitting,
      processing.entity,
      processing.transition,
    );
  }

  async function persistProcessingPayment(): Promise<{
    payment: StoredPayment;
    attempt: StoredPaymentAttempt;
  }> {
    let payment = await persistPayment('concurrent-terminal-transition');
    const attempt = await persistAttempt(payment, fixture.providerId, 'good-provider', 1);

    const submitting = transitionPayment(payment.payment, {
      to: 'SUBMITTING',
      source: 'SYSTEM',
      reason: 'Submission started',
      evidence: createSystemEvidence('SUBMISSION_STARTED', now),
      processedAt: now,
    });
    if (submitting.kind !== 'TRANSITIONED') throw new Error('Expected payment transition');
    payment = await repository.savePaymentTransition(
      payment,
      submitting.entity,
      submitting.transition,
    );

    const processing = transitionPayment(payment.payment, {
      to: 'PROCESSING',
      source: 'IMMEDIATE_RESPONSE',
      reason: 'Provider accepted payment',
      evidence: providerEvidence(attempt, 'PROCESSING', 'pending'),
      processedAt: new Date(now.getTime() + 1_000),
    });
    if (processing.kind !== 'TRANSITIONED') throw new Error('Expected payment transition');
    payment = await repository.savePaymentTransition(
      payment,
      processing.entity,
      processing.transition,
    );
    return { payment, attempt };
  }
});

function newPayment(merchantReference: string): Payment {
  return createPayment({
    id: randomUUID(),
    merchantReference,
    customerId: 'customer-1',
    amount: Money.fromMinor(50_000, 'NGN'),
    requestedAt: now,
  });
}

function providerEvidence(
  attempt: StoredPaymentAttempt,
  state: 'PROCESSING' | 'SUCCEEDED' | 'FAILED',
  rawStatus: string,
) {
  return createProviderEvidence({
    attemptId: attempt.attempt.id,
    provider: attempt.attempt.provider,
    providerReference: 'provider-reference-1',
    rawStatus,
    normalizedState: state,
    reportedAmount: Money.fromMinor(50_000, 'NGN'),
    occurredAt: now,
    receivedAt: now,
  });
}

async function seedReferenceData(database: RailBridgeDatabase): Promise<FixtureIds> {
  const ids: FixtureIds = {
    legalEntityId: randomUUID(),
    otherLegalEntityId: randomUUID(),
    paymentMethodId: randomUUID(),
    providerId: randomUUID(),
    otherProviderId: randomUUID(),
  };

  await database.insert(legalEntities).values([
    { id: ids.legalEntityId, code: 'CXM-UK', name: 'CXM UK' },
    { id: ids.otherLegalEntityId, code: 'CXM-NG', name: 'CXM Nigeria' },
  ]);
  await database.insert(paymentMethods).values({
    id: ids.paymentMethodId,
    code: 'BANK_TRANSFER',
    displayName: 'Bank transfer',
  });
  await database.insert(providers).values([
    {
      id: ids.providerId,
      code: 'good-provider',
      displayName: 'Good Provider',
      environment: 'SANDBOX',
    },
    {
      id: ids.otherProviderId,
      code: 'other-provider',
      displayName: 'Other Provider',
      environment: 'SANDBOX',
    },
  ]);
  return ids;
}

async function expectPostgresCode(
  operation: Promise<unknown>,
  expectedCode: string,
): Promise<void> {
  try {
    await operation;
  } catch (error) {
    expect(findErrorCode(error)).toBe(expectedCode);
    return;
  }
  throw new Error(`Expected PostgreSQL error ${expectedCode}`);
}

function findErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  if ('code' in error && typeof error.code === 'string') return error.code;
  if ('cause' in error) return findErrorCode(error.cause);
  return undefined;
}
