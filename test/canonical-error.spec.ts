import { describe, expect, it } from 'vitest';

import {
  CANONICAL_ERROR_CATEGORIES,
  createCanonicalError,
  recoveryActionFor,
  type CanonicalErrorCategory,
  type RecoveryAction,
} from '../src/domain/payments/index.js';

const expectedActions = {
  VALIDATION: 'DO_NOT_RETRY',
  AUTHENTICATION: 'DO_NOT_RETRY',
  RATE_LIMIT: 'RETRY_AFTER',
  TEMPORARY: 'RETRY_WITH_BACKOFF',
  PERMANENT: 'DO_NOT_RETRY',
  UNKNOWN_RESULT: 'VERIFY_PROVIDER_STATUS',
} as const satisfies Record<CanonicalErrorCategory, RecoveryAction>;

describe('canonical error taxonomy', () => {
  it.each(CANONICAL_ERROR_CATEGORIES)(
    'keeps %s classification separate from recovery action',
    (category) => {
      const error = createCanonicalError({
        category,
        code: `EXAMPLE_${category}`,
        message: `Example ${category} error`,
      });

      expect(error.category).toBe(category);
      expect(recoveryActionFor(error)).toBe(expectedActions[category]);
    },
  );

  it('does not classify an unknown result as a safe retry', () => {
    const timeout = createCanonicalError({
      category: 'UNKNOWN_RESULT',
      code: 'CREATE_TIMEOUT',
      message: 'The POST may have reached the provider',
    });

    expect(recoveryActionFor(timeout)).toBe('VERIFY_PROVIDER_STATUS');
  });
});
