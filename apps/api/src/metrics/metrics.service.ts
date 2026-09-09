import { Injectable } from '@nestjs/common';
import type { DependencyChecks } from '../health/health.types.js';
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

  getPrometheusText(dependencies: DependencyChecks) {
    const snapshot = this.getSnapshot();
    const statusLines = Object.entries(snapshot.http.responsesByStatus)
      .map(([statusClass, value]) =>
        `fullstack_http_responses_total{status_class="${statusClass}"} ${value}`,
      );
    return [
      '# HELP fullstack_process_uptime_seconds API process uptime.',
      '# TYPE fullstack_process_uptime_seconds gauge',
      `fullstack_process_uptime_seconds ${snapshot.processUptimeSeconds}`,
      '# HELP fullstack_http_requests_total Completed HTTP requests.',
      '# TYPE fullstack_http_requests_total counter',
      `fullstack_http_requests_total ${snapshot.http.requestsTotal}`,
      '# HELP fullstack_http_requests_active HTTP requests currently running.',
      '# TYPE fullstack_http_requests_active gauge',
      `fullstack_http_requests_active ${snapshot.http.requestsActive}`,
      '# HELP fullstack_http_responses_total HTTP responses by status class.',
      '# TYPE fullstack_http_responses_total counter',
      ...statusLines,
      '# HELP fullstack_http_request_duration_seconds HTTP request duration.',
      '# TYPE fullstack_http_request_duration_seconds summary',
      `fullstack_http_request_duration_seconds_sum ${this.totalDurationMs / 1000}`,
      `fullstack_http_request_duration_seconds_count ${this.requestsTotal}`,
      '# HELP fullstack_dependency_up Whether a required dependency is reachable.',
      '# TYPE fullstack_dependency_up gauge',
      `fullstack_dependency_up{dependency="postgres"} ${this.toGauge(dependencies.postgres)}`,
      `fullstack_dependency_up{dependency="minio"} ${this.toGauge(dependencies.minio)}`,
      '',
    ].join('\n');
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

  private toGauge(status: DependencyChecks[keyof DependencyChecks]) {
    return status === 'up' ? 1 : 0;
  }
}
