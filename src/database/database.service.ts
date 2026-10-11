import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import type { Pool } from 'pg';

import { DATABASE_POOL } from './database.constants.js';

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async checkReadiness(timeoutMs: number): Promise<void> {
    const connection = await this.pool.connect();

    try {
      await connection.query('BEGIN');
      await connection.query(`SELECT set_config('statement_timeout', $1, true)`, [
        `${timeoutMs}ms`,
      ]);
      const result = await connection.query<{ payments_table: string | null }>(
        `SELECT to_regclass('public.payments')::text AS payments_table`,
      );

      if (result.rows[0]?.payments_table !== 'payments') {
        throw new Error('Required database migrations have not been applied');
      }
    } finally {
      await connection.query('ROLLBACK');
      connection.release();
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
