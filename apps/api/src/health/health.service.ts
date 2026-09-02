import { Injectable } from '@nestjs/common';
import type { HealthResponse } from './health.types.js';

@Injectable()
export class HealthService {
  getStatus(): HealthResponse {
    return {
      status: 'ok',
      service: 'fullstack-learning-api',
      serverTime: new Date().toISOString(),
      version: '1.0.0',
    };
  }
}
