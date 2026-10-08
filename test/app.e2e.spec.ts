import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { PostgresTcpHealthIndicator } from '../src/health/postgres-tcp.health-indicator.js';
import { CORRELATION_ID_HEADER } from '../src/observability/correlation-id.js';

describe('application foundation', () => {
  let app: INestApplication;
  let httpServer: Server;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PostgresTcpHealthIndicator)
      .useValue({ check: vi.fn().mockResolvedValue({ postgres: { status: 'up' } }) })
      .compile();

    app = moduleRef.createNestApplication({ bufferLogs: true });
    await app.init();
    httpServer = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports liveness and returns a correlation ID', async () => {
    const response = await request(httpServer).get('/health/live').expect(200);

    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers[CORRELATION_ID_HEADER]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('preserves a safe caller correlation ID', async () => {
    const response = await request(httpServer)
      .get('/health/live')
      .set(CORRELATION_ID_HEADER, 'stage-1-test')
      .expect(200);

    expect(response.headers[CORRELATION_ID_HEADER]).toBe('stage-1-test');
  });

  it('reports readiness from mandatory dependency indicators', async () => {
    const response = await request(httpServer).get('/health/ready').expect(200);
    const body = response.body as {
      status: string;
      info: { postgres: { status: string } };
    };

    expect(body.status).toBe('ok');
    expect(body.info.postgres.status).toBe('up');
  });

  it('uses the canonical error envelope', async () => {
    const response = await request(httpServer).get('/does-not-exist').expect(404);
    const body = response.body as {
      error: {
        code: string;
        correlationId: string;
        path: string;
        timestamp: string;
      };
    };

    expect(body).toMatchObject({
      error: {
        code: 'NOT_FOUND',
        path: '/does-not-exist',
      },
    });
    expect(body.error.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(Number.isNaN(Date.parse(body.error.timestamp))).toBe(false);
  });
});
