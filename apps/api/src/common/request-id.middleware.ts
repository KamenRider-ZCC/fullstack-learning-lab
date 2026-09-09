import { Inject, Injectable, Logger } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { MetricsService } from '../metrics/metrics.service.js';

const requestIdPattern = /^[A-Za-z0-9._-]{1,100}$/;

export interface RequestWithId extends Request {
  requestId: string;
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestIdMiddleware.name);

  constructor(
    @Inject(MetricsService) private readonly metricsService: MetricsService,
  ) {}

  use(request: RequestWithId, response: Response, next: NextFunction) {
    const startedAt = Date.now();
    const requestPath = request.originalUrl.split('?')[0];
    const shouldMeasure = requestPath !== '/api/metrics';
    request.requestId = this.resolveRequestId(request);
    response.setHeader('X-Request-Id', request.requestId);
    if (shouldMeasure) this.metricsService.requestStarted();

    response.once('finish', () => {
      const durationMs = Date.now() - startedAt;
      if (shouldMeasure) {
        this.metricsService.requestCompleted(response.statusCode, durationMs);
      }
      this.logger.log(JSON.stringify({
        event: 'http_request_completed',
        requestId: request.requestId,
        method: request.method,
        path: requestPath,
        statusCode: response.statusCode,
        durationMs,
      }));
    });

    next();
  }

  private resolveRequestId(request: Request) {
    const incomingId = request.header('x-request-id');
    return incomingId && requestIdPattern.test(incomingId)
      ? incomingId
      : randomUUID();
  }
}
