import { Controller, Get, Header, Inject } from '@nestjs/common';
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

  @Get('prometheus')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  getPrometheusMetrics(): string {
    return this.metricsService.getPrometheusText();
  }
}
