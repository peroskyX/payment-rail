import { Socket } from 'node:net';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthIndicatorService, type HealthIndicatorResult } from '@nestjs/terminus';

import type { EnvironmentVariables } from '../config/environment.js';

@Injectable()
export class PostgresTcpHealthIndicator {
  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly healthIndicator: HealthIndicatorService,
  ) {}

  async check(): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicator.check('postgres');
    const databaseUrl = new URL(this.config.get('DATABASE_URL', { infer: true }));
    const host = databaseUrl.hostname;
    const port = Number(databaseUrl.port || 5432);
    const timeoutMs = this.config.get('POSTGRES_READINESS_TIMEOUT_MS', { infer: true });

    try {
      await this.connect(host, port, timeoutMs);
      return indicator.up();
    } catch {
      return indicator.down({ message: `Cannot reach PostgreSQL at ${host}:${port}` });
    }
  }

  private connect(host: string, port: number, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new Socket();

      const finish = (error?: Error): void => {
        socket.removeAllListeners();
        socket.destroy();
        if (error) reject(error);
        else resolve();
      };

      socket.setTimeout(timeoutMs);
      socket.once('connect', () => finish());
      socket.once('timeout', () => finish(new Error('Connection timed out')));
      socket.once('error', (error) => finish(error));
      socket.connect(port, host);
    });
  }
}
