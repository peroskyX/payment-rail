import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import type { EnvironmentVariables } from '../config/environment.js';
import { ConfigurationModule } from '../config/configuration.module.js';
import { DATABASE_CLIENT, DATABASE_POOL } from './database.constants.js';
import { DatabaseService } from './database.service.js';
import * as schema from './schema.js';

@Module({
  imports: [ConfigurationModule],
  providers: [
    {
      provide: DATABASE_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>): Pool => {
        const readinessTimeout = config.get('POSTGRES_READINESS_TIMEOUT_MS', { infer: true });
        return new Pool({
          connectionString: config.get('DATABASE_URL', { infer: true }),
          application_name: 'railbridge',
          connectionTimeoutMillis: readinessTimeout,
          max: 10,
        });
      },
    },
    {
      provide: DATABASE_CLIENT,
      inject: [DATABASE_POOL],
      useFactory: (pool: Pool) => drizzle({ client: pool, schema }),
    },
    DatabaseService,
  ],
  exports: [DATABASE_CLIENT, DatabaseService],
})
export class DatabaseModule {}
