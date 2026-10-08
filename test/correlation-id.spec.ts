import { EventEmitter } from 'node:events';

import { describe, expect, it } from 'vitest';

import {
  CORRELATION_ID_HEADER,
  resolveCorrelationId,
} from '../src/observability/correlation-id.js';

class ResponseStub extends EventEmitter {
  readonly headers = new Map<string, string>();

  setHeader(name: string, value: string): this {
    this.headers.set(name, value);
    return this;
  }
}

describe('resolveCorrelationId', () => {
  it('preserves a valid caller-provided ID', () => {
    const response = new ResponseStub();
    const request = { headers: { [CORRELATION_ID_HEADER]: 'client-request-123' } };

    const result = resolveCorrelationId(request as never, response as never);

    expect(result).toBe('client-request-123');
    expect(response.headers.get(CORRELATION_ID_HEADER)).toBe(result);
  });

  it('replaces an unsafe value', () => {
    const response = new ResponseStub();
    const request = { headers: { [CORRELATION_ID_HEADER]: 'bad value\n' } };

    const result = resolveCorrelationId(request as never, response as never);

    expect(result).toMatch(/^[0-9a-f-]{36}$/);
    expect(result).not.toBe('bad value\n');
  });
});
