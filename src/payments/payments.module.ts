import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { PaymentLifecycleService } from './application/payment-lifecycle.service.js';
import { PAYMENT_REPOSITORY } from './application/payment.repository.js';
import { PostgresPaymentRepository } from './infrastructure/postgres-payment.repository.js';

@Module({
  imports: [DatabaseModule],
  providers: [
    PostgresPaymentRepository,
    {
      provide: PAYMENT_REPOSITORY,
      useExisting: PostgresPaymentRepository,
    },
    PaymentLifecycleService,
  ],
  exports: [PAYMENT_REPOSITORY, PaymentLifecycleService],
})
export class PaymentsModule {}
