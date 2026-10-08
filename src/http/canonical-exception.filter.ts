import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Logger } from 'nestjs-pino';

import { CORRELATION_ID_HEADER } from '../observability/correlation-id.js';

interface CanonicalErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
    correlationId: string;
    timestamp: string;
    path: string;
  };
}

interface ErrorDescriptor {
  code?: string;
  message?: string | string[];
  details?: unknown;
}

@Catch()
export class CanonicalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request & { id?: string }>();
    const response = http.getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const descriptor = this.describe(exception, status);
    const header = request.headers[CORRELATION_ID_HEADER];
    const correlationId = request.id ?? (typeof header === 'string' ? header : 'unknown');

    if (status >= 500) {
      this.logger.error(
        { err: exception, correlationId, path: request.originalUrl },
        'Unhandled request exception',
      );
    }

    const body: CanonicalErrorResponse = {
      error: {
        code: descriptor.code ?? this.defaultCode(status),
        message: this.message(descriptor.message, status),
        correlationId,
        timestamp: new Date().toISOString(),
        path: request.originalUrl,
      },
    };

    if (descriptor.details !== undefined) {
      body.error.details = descriptor.details;
    }

    response.status(status).json(body);
  }

  private describe(exception: unknown, status: number): ErrorDescriptor {
    if (!(exception instanceof HttpException)) {
      return {};
    }

    const payload: unknown = exception.getResponse();
    if (typeof payload === 'string') {
      return { message: payload };
    }

    if (typeof payload === 'object' && payload !== null) {
      return payload;
    }

    return { message: HttpStatus[status] };
  }

  private message(message: string | string[] | undefined, status: number): string {
    if (status >= 500) {
      return 'An unexpected error occurred';
    }

    if (Array.isArray(message)) {
      return 'Request validation failed';
    }

    return message ?? HttpStatus[status] ?? 'Request failed';
  }

  private defaultCode(status: number): string {
    const names: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'RATE_LIMITED',
      500: 'INTERNAL_ERROR',
      503: 'SERVICE_UNAVAILABLE',
    };

    return names[status] ?? `HTTP_${status}`;
  }
}
