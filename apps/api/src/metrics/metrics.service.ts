import { Injectable } from '@nestjs/common';
import type { HttpStatusCounts, MetricsSnapshot } from './metrics.types.js';

@Injectable()
export class MetricsService {
  private requestsTotal = 0;
  private requestsActive = 0;
  private totalDurationMs = 0;
  private readonly responsesByStatus: HttpStatusCounts = {
    '2xx': 0,
    '3xx': 0,
    '4xx': 0,
    '5xx': 0,
    other: 0,
  };

  requestStarted() {
    this.requestsActive += 1;
  }

  requestCompleted(statusCode: number, durationMs: number) {
    this.requestsActive = Math.max(0, this.requestsActive - 1);
    this.requestsTotal += 1;
    this.totalDurationMs += durationMs;
    this.responsesByStatus[this.toStatusClass(statusCode)] += 1;
  }

  getSnapshot(): MetricsSnapshot {
    const serverErrorsTotal = this.responsesByStatus['5xx'];
    return {
      generatedAt: new Date().toISOString(),
      processUptimeSeconds: Math.round(process.uptime()),
      http: {
        requestsTotal: this.requestsTotal,
        requestsActive: this.requestsActive,
        responsesByStatus: { ...this.responsesByStatus },
        serverErrorsTotal,
        serverErrorRatePercent: this.toPercent(
          serverErrorsTotal,
          this.requestsTotal,
        ),
        averageDurationMs: this.toAverage(
          this.totalDurationMs,
          this.requestsTotal,
        ),
      },
    };
  }

  private toStatusClass(statusCode: number): keyof HttpStatusCounts {
    const statusClass = Math.floor(statusCode / 100);
    if (statusClass >= 2 && statusClass <= 5) {
      return `${statusClass}xx` as keyof HttpStatusCounts;
    }
    return 'other';
  }

  private toPercent(part: number, total: number) {
    return total === 0 ? 0 : Number(((part / total) * 100).toFixed(2));
  }

  private toAverage(total: number, count: number) {
    return count === 0 ? 0 : Number((total / count).toFixed(2));
  }
}
