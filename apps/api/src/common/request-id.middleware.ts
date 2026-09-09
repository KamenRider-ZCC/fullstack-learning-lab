import { Injectable, Logger } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const requestIdPattern = /^[A-Za-z0-9._-]{1,100}$/;

export interface RequestWithId extends Request {
  requestId: string;
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestIdMiddleware.name);

  use(request: RequestWithId, response: Response, next: NextFunction) {
    const startedAt = Date.now();
    request.requestId = this.resolveRequestId(request);
    response.setHeader('X-Request-Id', request.requestId);

    response.once('finish', () => {
      this.logger.log(JSON.stringify({
        event: 'http_request_completed',
        requestId: request.requestId,
        method: request.method,
        path: request.path,
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt,
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
