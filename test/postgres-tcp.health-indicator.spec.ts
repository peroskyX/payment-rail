import type { ConfigService } from '@nestjs/config';
import type { HealthIndicatorService } from '@nestjs/terminus';
import { describe, expect, it, vi } from 'vitest';

import type { EnvironmentVariables } from '../src/config/environment.js';
import { PostgresTcpHealthIndicator } from '../src/health/postgres-tcp.health-indicator.js';

describe('PostgresTcpHealthIndicator', () => {
  it('reports down when the configured endpoint cannot be reached', async () => {
    const values: Partial<EnvironmentVariables> = {
      DATABASE_URL: 'postgresql://railbridge:railbridge@127.0.0.1:1/unavailable',
      POSTGRES_READINESS_TIMEOUT_MS: 50,
    };
    const config = {
      get: vi.fn((key: keyof EnvironmentVariables) => values[key]),
    } as unknown as ConfigService<EnvironmentVariables, true>;
    const health = {
      check: vi.fn(() => ({
        up: () => ({ postgres: { status: 'up' } }),
        down: (details: object) => ({ postgres: { status: 'down', ...details } }),
      })),
    } as unknown as HealthIndicatorService;
    const indicator = new PostgresTcpHealthIndicator(config, health);

    await expect(indicator.check()).resolves.toMatchObject({
      postgres: {
        status: 'down',
        message: 'Cannot reach PostgreSQL at 127.0.0.1:1',
      },
    });
  });
});
