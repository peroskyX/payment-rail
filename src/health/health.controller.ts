import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, type HealthCheckResult } from '@nestjs/terminus';

import { PostgresTcpHealthIndicator } from './postgres-tcp.health-indicator.js';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly postgres: PostgresTcpHealthIndicator,
  ) {}

  @Get('live')
  liveness(): { status: 'ok' } {
    throw new Error('Stage 1 deliberate failure');

  }

  @Get('ready')
  @HealthCheck()
  readiness(): Promise<HealthCheckResult> {
    return this.health.check([() => this.postgres.check()]);
  }
}
