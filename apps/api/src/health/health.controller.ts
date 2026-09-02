import { Controller, Get, Inject } from '@nestjs/common';
import { HealthService } from './health.service.js';
import type { HealthResponse } from './health.types.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get()
  getStatus(): HealthResponse {
    return this.healthService.getStatus();
  }
}
