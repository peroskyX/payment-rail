import { describe, expect, it } from 'vitest';

import { validateEnvironment } from '../src/config/environment.js';

const validEnvironment = {
  NODE_ENV: 'test',
  PORT: '3001',
  LOG_LEVEL: 'silent',
  DATABASE_URL: 'postgresql://railbridge:railbridge@127.0.0.1:5432/railbridge_test',
  POSTGRES_READINESS_TIMEOUT_MS: '100',
};

describe('validateEnvironment', () => {
  it('converts validated numeric configuration', () => {
    const result = validateEnvironment(validEnvironment);

    expect(result.PORT).toBe(3001);
    expect(result.POSTGRES_READINESS_TIMEOUT_MS).toBe(100);
  });

  it.each([
    ['missing database URL', { DATABASE_URL: undefined }],
    ['invalid port', { PORT: '70000' }],
    ['invalid environment', { NODE_ENV: 'staging' }],
    ['invalid log level', { LOG_LEVEL: 'verbose' }],
  ])('rejects %s', (_name, change) => {
    expect(() => validateEnvironment({ ...validEnvironment, ...change })).toThrow(
      'Invalid environment configuration',
    );
  });
});
