import type { ConfigService } from '@nestjs/config';
import type { HealthIndicatorService } from '@nestjs/terminus';
import { describe, expect, it, vi } from 'vitest';

import type { EnvironmentVariables } from '../src/config/environment.js';
import type { DatabaseService } from '../src/database/database.service.js';
import { PostgresHealthIndicator } from '../src/health/postgres.health-indicator.js';

describe('PostgresHealthIndicator', () => {
  it('reports down when a query or schema readiness check fails', async () => {
    const database = {
      checkReadiness: vi.fn().mockRejectedValue(new Error('payments table missing')),
    } as unknown as DatabaseService;
    const config = {
      get: vi.fn(() => 50),
    } as unknown as ConfigService<EnvironmentVariables, true>;
    const health = {
      check: vi.fn(() => ({
        up: () => ({ postgres: { status: 'up' } }),
        down: (details: object) => ({ postgres: { status: 'down', ...details } }),
      })),
    } as unknown as HealthIndicatorService;
    const indicator = new PostgresHealthIndicator(database, config, health);

    await expect(indicator.check()).resolves.toMatchObject({
      postgres: {
        status: 'down',
        message: 'PostgreSQL query or required schema check failed',
      },
    });
  });
});
