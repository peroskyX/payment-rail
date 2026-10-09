import { InvalidDomainValueError } from '../shared/domain-error.js';
import { requireNonBlank } from '../shared/validation.js';

export const CANONICAL_ERROR_CATEGORIES = [
  'VALIDATION',
  'AUTHENTICATION',
  'RATE_LIMIT',
  'TEMPORARY',
  'PERMANENT',
  'UNKNOWN_RESULT',
] as const;

export type CanonicalErrorCategory = (typeof CANONICAL_ERROR_CATEGORIES)[number];

export interface CanonicalError {
  readonly category: CanonicalErrorCategory;
  readonly code: string;
  readonly message: string;
  readonly provider?: string;
  readonly retryAfterMs?: number;
}

export interface CanonicalErrorInput {
  readonly category: CanonicalErrorCategory;
  readonly code: string;
  readonly message: string;
  readonly provider?: string;
  readonly retryAfterMs?: number;
}

export function createCanonicalError(input: CanonicalErrorInput): CanonicalError {
  if (
    input.retryAfterMs !== undefined &&
    (!Number.isSafeInteger(input.retryAfterMs) || input.retryAfterMs < 0)
  ) {
    throw new InvalidDomainValueError('retryAfterMs', 'must be a non-negative safe integer');
  }

  return Object.freeze({
    category: input.category,
    code: requireNonBlank(input.code, 'code'),
    message: requireNonBlank(input.message, 'message'),
    ...(input.provider === undefined
      ? {}
      : { provider: requireNonBlank(input.provider, 'provider') }),
    ...(input.retryAfterMs === undefined ? {} : { retryAfterMs: input.retryAfterMs }),
  });
}

export const RECOVERY_ACTIONS = [
  'DO_NOT_RETRY',
  'RETRY_WITH_BACKOFF',
  'RETRY_AFTER',
  'VERIFY_PROVIDER_STATUS',
] as const;

export type RecoveryAction = (typeof RECOVERY_ACTIONS)[number];

export function recoveryActionFor(error: CanonicalError): RecoveryAction {
  switch (error.category) {
    case 'VALIDATION':
    case 'AUTHENTICATION':
    case 'PERMANENT':
      return 'DO_NOT_RETRY';
    case 'RATE_LIMIT':
      return 'RETRY_AFTER';
    case 'TEMPORARY':
      return 'RETRY_WITH_BACKOFF';
    case 'UNKNOWN_RESULT':
      return 'VERIFY_PROVIDER_STATUS';
  }
}
