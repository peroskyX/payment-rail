import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';

import { ConfigurationModule } from './config/configuration.module.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { CanonicalExceptionFilter } from './http/canonical-exception.filter.js';
import { createRequestValidationPipe } from './http/request-validation.pipe.js';
import { ObservabilityModule } from './observability/observability.module.js';
import { PaymentsModule } from './payments/payments.module.js';

@Module({
  imports: [ConfigurationModule, DatabaseModule, ObservabilityModule, HealthModule, PaymentsModule],
  providers: [
    {
      provide: APP_PIPE,
      useFactory: createRequestValidationPipe,
    },
    {
      provide: APP_FILTER,
      useClass: CanonicalExceptionFilter,
    },
  ],
})
export class AppModule {}
