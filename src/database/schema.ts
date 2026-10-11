import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { FULFILLMENT_STATES } from '../domain/payments/payment.js';
import { PAYMENT_STATES } from '../domain/payments/payment-state.js';
import { TRANSITION_SOURCES } from '../domain/payments/evidence.js';

export const PROVIDER_ENVIRONMENTS = ['SANDBOX', 'PRODUCTION'] as const;
export const TRANSITION_ENTITY_TYPES = ['PAYMENT', 'PAYMENT_ATTEMPT', 'FULFILLMENT'] as const;
export const EVIDENCE_KINDS = ['PROVIDER', 'SYSTEM', 'ERROR'] as const;

export const providerEnvironmentEnum = pgEnum('provider_environment', PROVIDER_ENVIRONMENTS);
export const paymentStateEnum = pgEnum('payment_state', PAYMENT_STATES);
export const fulfillmentStateEnum = pgEnum('fulfillment_state', FULFILLMENT_STATES);
export const transitionSourceEnum = pgEnum('transition_source', TRANSITION_SOURCES);
export const transitionEntityTypeEnum = pgEnum('transition_entity_type', TRANSITION_ENTITY_TYPES);
export const evidenceKindEnum = pgEnum('evidence_kind', EVIDENCE_KINDS);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
};

export const legalEntities = pgTable(
  'legal_entities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    enabled: boolean('enabled').notNull().default(true),
    ...timestamps,
  },
  (table) => [uniqueIndex('legal_entities_code_uq').on(table.code)],
);

export const providers = pgTable(
  'providers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 64 }).notNull(),
    displayName: varchar('display_name', { length: 160 }).notNull(),
    environment: providerEnvironmentEnum('environment').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    ...timestamps,
  },
  (table) => [uniqueIndex('providers_code_environment_uq').on(table.code, table.environment)],
);

export const paymentMethods = pgTable(
  'payment_methods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 64 }).notNull(),
    displayName: varchar('display_name', { length: 160 }).notNull(),
    enabled: boolean('enabled').notNull().default(true),
    ...timestamps,
  },
  (table) => [uniqueIndex('payment_methods_code_uq').on(table.code)],
);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey(),
    legalEntityId: uuid('legal_entity_id')
      .notNull()
      .references(() => legalEntities.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    paymentMethodId: uuid('payment_method_id')
      .notNull()
      .references(() => paymentMethods.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    merchantReference: varchar('merchant_reference', { length: 128 }).notNull(),
    customerId: varchar('customer_id', { length: 128 }).notNull(),
    requestedAmountMinor: bigint('requested_amount_minor', { mode: 'number' }).notNull(),
    requestedCurrency: varchar('requested_currency', { length: 3 }).notNull(),
    confirmedAmountMinor: bigint('confirmed_amount_minor', { mode: 'number' }),
    confirmedCurrency: varchar('confirmed_currency', { length: 3 }),
    state: paymentStateEnum('state').notNull().default('CREATED'),
    fulfillmentState: fulfillmentStateEnum('fulfillment_state').notNull().default('NOT_STARTED'),
    version: integer('version').notNull().default(0),
    requestedAt: timestamp('requested_at', { withTimezone: true, mode: 'date' }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [
    uniqueIndex('payments_entity_merchant_reference_uq').on(
      table.legalEntityId,
      table.merchantReference,
    ),
    index('payments_customer_requested_at_idx').on(table.customerId, table.requestedAt),
    index('payments_entity_state_requested_at_idx').on(
      table.legalEntityId,
      table.state,
      table.requestedAt,
    ),
    check(
      'payments_requested_amount_safe_positive_ck',
      sql`${table.requestedAmountMinor} > 0 AND ${table.requestedAmountMinor} <= 9007199254740991`,
    ),
    check('payments_version_non_negative_ck', sql`${table.version} >= 0`),
    check(
      'payments_confirmed_money_complete_ck',
      sql`(${table.confirmedAmountMinor} IS NULL AND ${table.confirmedCurrency} IS NULL) OR (${table.confirmedAmountMinor} IS NOT NULL AND ${table.confirmedCurrency} IS NOT NULL)`,
    ),
    check(
      'payments_requested_currency_supported_ck',
      sql`${table.requestedCurrency} IN ('EUR', 'GBP', 'GHS', 'JPY', 'KES', 'KWD', 'NGN', 'USD')`,
    ),
    check(
      'payments_confirmed_currency_supported_ck',
      sql`${table.confirmedCurrency} IS NULL OR ${table.confirmedCurrency} IN ('EUR', 'GBP', 'GHS', 'JPY', 'KES', 'KWD', 'NGN', 'USD')`,
    ),
  ],
);

export const paymentAttempts = pgTable(
  'payment_attempts',
  {
    id: uuid('id').primaryKey(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    providerId: uuid('provider_id')
      .notNull()
      .references(() => providers.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    sequence: integer('sequence').notNull(),
    state: paymentStateEnum('state').notNull().default('CREATED'),
    providerReference: varchar('provider_reference', { length: 160 }),
    reportedAmountMinor: bigint('reported_amount_minor', { mode: 'number' }),
    reportedCurrency: varchar('reported_currency', { length: 3 }),
    version: integer('version').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [
    uniqueIndex('payment_attempts_payment_sequence_uq').on(table.paymentId, table.sequence),
    uniqueIndex('payment_attempts_provider_reference_uq').on(
      table.providerId,
      table.providerReference,
    ),
    index('payment_attempts_payment_created_at_idx').on(table.paymentId, table.createdAt),
    index('payment_attempts_provider_state_updated_at_idx').on(
      table.providerId,
      table.state,
      table.updatedAt,
    ),
    check('payment_attempts_sequence_positive_ck', sql`${table.sequence} > 0`),
    check('payment_attempts_version_non_negative_ck', sql`${table.version} >= 0`),
    check(
      'payment_attempts_reported_money_complete_ck',
      sql`(${table.reportedAmountMinor} IS NULL AND ${table.reportedCurrency} IS NULL) OR (${table.reportedAmountMinor} IS NOT NULL AND ${table.reportedCurrency} IS NOT NULL)`,
    ),
    check(
      'payment_attempts_reported_currency_supported_ck',
      sql`${table.reportedCurrency} IS NULL OR ${table.reportedCurrency} IN ('EUR', 'GBP', 'GHS', 'JPY', 'KES', 'KWD', 'NGN', 'USD')`,
    ),
  ],
);

export const paymentStateHistory = pgTable(
  'payment_state_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    attemptId: uuid('attempt_id').references(() => paymentAttempts.id, {
      onDelete: 'restrict',
      onUpdate: 'restrict',
    }),
    providerId: uuid('provider_id').references(() => providers.id, {
      onDelete: 'restrict',
      onUpdate: 'restrict',
    }),
    entityType: transitionEntityTypeEnum('entity_type').notNull(),
    fromState: varchar('from_state', { length: 32 }).notNull(),
    toState: varchar('to_state', { length: 32 }).notNull(),
    source: transitionSourceEnum('source').notNull(),
    reason: text('reason').notNull(),
    evidenceKind: evidenceKindEnum('evidence_kind').notNull(),
    providerReference: varchar('provider_reference', { length: 160 }),
    providerEventId: varchar('provider_event_id', { length: 160 }),
    providerRawStatus: varchar('provider_raw_status', { length: 160 }),
    systemEvidenceCode: varchar('system_evidence_code', { length: 96 }),
    errorCategory: varchar('error_category', { length: 32 }),
    errorCode: varchar('error_code', { length: 96 }),
    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date' }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true, mode: 'date' }).notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true, mode: 'date' }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('payment_state_history_payment_processed_at_idx').on(table.paymentId, table.processedAt),
    index('payment_state_history_attempt_processed_at_idx').on(table.attemptId, table.processedAt),
    check('payment_state_history_state_change_ck', sql`${table.fromState} <> ${table.toState}`),
    check(
      'payment_state_history_entity_state_ck',
      sql`(${table.entityType} = 'FULFILLMENT' AND ${table.fromState} IN ('NOT_STARTED', 'CREDIT_PENDING', 'CREDITED', 'CREDIT_FAILED') AND ${table.toState} IN ('NOT_STARTED', 'CREDIT_PENDING', 'CREDITED', 'CREDIT_FAILED')) OR (${table.entityType} IN ('PAYMENT', 'PAYMENT_ATTEMPT') AND ${table.fromState} IN ('CREATED', 'SUBMITTING', 'REQUIRES_ACTION', 'PROCESSING', 'UNKNOWN', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED') AND ${table.toState} IN ('CREATED', 'SUBMITTING', 'REQUIRES_ACTION', 'PROCESSING', 'UNKNOWN', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED'))`,
    ),
    check(
      'payment_state_history_evidence_shape_ck',
      sql`(${table.evidenceKind} = 'PROVIDER' AND ${table.attemptId} IS NOT NULL AND ${table.providerId} IS NOT NULL AND ${table.providerRawStatus} IS NOT NULL) OR (${table.evidenceKind} = 'SYSTEM' AND ${table.systemEvidenceCode} IS NOT NULL) OR (${table.evidenceKind} = 'ERROR' AND ${table.errorCategory} IS NOT NULL AND ${table.errorCode} IS NOT NULL)`,
    ),
  ],
);

export type PaymentRow = typeof payments.$inferSelect;
export type PaymentAttemptRow = typeof paymentAttempts.$inferSelect;
export type PaymentStateHistoryRow = typeof paymentStateHistory.$inferSelect;
