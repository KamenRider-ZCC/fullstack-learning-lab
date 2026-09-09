import { Controller, Get, Inject } from '@nestjs/common';
import { MetricsService } from './metrics.service.js';
import type { MetricsSnapshot } from './metrics.types.js';

@Controller('metrics')
export class MetricsController {
  constructor(
    @Inject(MetricsService) private readonly metricsService: MetricsService,
  ) {}

  @Get()
  getMetrics(): MetricsSnapshot {
    return this.metricsService.getSnapshot();
  }
}
