import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthIndicatorService, type HealthIndicatorResult } from '@nestjs/terminus';

import type { EnvironmentVariables } from '../config/environment.js';
import { DatabaseService } from '../database/database.service.js';

@Injectable()
export class PostgresHealthIndicator {
  constructor(
    private readonly database: DatabaseService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly healthIndicator: HealthIndicatorService,
  ) {}

  async check(): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicator.check('postgres');
    const timeoutMs = this.config.get('POSTGRES_READINESS_TIMEOUT_MS', { infer: true });

    try {
      await this.database.checkReadiness(timeoutMs);
      return indicator.up();
    } catch {
      return indicator.down({ message: 'PostgreSQL query or required schema check failed' });
    }
  }
}
