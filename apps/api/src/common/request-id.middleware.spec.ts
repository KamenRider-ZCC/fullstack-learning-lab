import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import {
  RequestIdMiddleware,
  type RequestWithId,
} from './request-id.middleware.js';

function createResponse() {
  let finishHandler: (() => void) | undefined;
  const response = {
    statusCode: 200,
    setHeader: vi.fn(),
    once: vi.fn((_event: string, handler: () => void) => {
      finishHandler = handler;
    }),
  } as unknown as Response;
  return { response, finish: () => finishHandler?.() };
}

function createRequest(incomingId?: string) {
  return {
    method: 'GET',
    path: '/api/health/live',
    header: vi.fn(() => incomingId),
  } as unknown as RequestWithId;
}

describe('RequestIdMiddleware', () => {
  it('没有上游 ID 时生成 ID 并写入响应头', () => {
    const middleware = new RequestIdMiddleware();
    const request = createRequest();
    const { response, finish } = createResponse();
    const next = vi.fn() as NextFunction;

    middleware.use(request, response, next);
    finish();

    expect(request.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.setHeader).toHaveBeenCalledWith(
      'X-Request-Id',
      request.requestId,
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it('复用格式安全的上游 ID', () => {
    const middleware = new RequestIdMiddleware();
    const request = createRequest('gateway-request-123');
    const { response } = createResponse();

    middleware.use(request, response, vi.fn());

    expect(request.requestId).toBe('gateway-request-123');
  });

  it('拒绝可能污染日志的上游 ID', () => {
    const middleware = new RequestIdMiddleware();
    const request = createRequest('bad\nforged-log-entry');
    const { response } = createResponse();

    middleware.use(request, response, vi.fn());

    expect(request.requestId).not.toContain('\n');
    expect(request.requestId).not.toBe('bad\nforged-log-entry');
  });
});
