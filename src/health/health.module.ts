import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { HealthController } from './health.controller.js';
import { PostgresTcpHealthIndicator } from './postgres-tcp.health-indicator.js';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [PostgresTcpHealthIndicator],
})
export class HealthModule {}
