import { Controller, Get, Inject } from '@nestjs/common';
import { HealthService } from './health.service.js';
import type { HealthResponse, ReadinessResponse } from './health.types.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get()
  getStatus(): HealthResponse {
    return this.healthService.getLiveness();
  }

  @Get('live')
  getLiveness(): HealthResponse {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  getReadiness(): Promise<ReadinessResponse> {
    return this.healthService.getReadiness();
  }
}
