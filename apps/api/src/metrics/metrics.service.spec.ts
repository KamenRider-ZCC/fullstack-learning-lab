import { beforeEach, describe, expect, it } from 'vitest';
import { MetricsService } from './metrics.service.js';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
  });

  it('初始指标为零', () => {
    expect(service.getSnapshot().http).toMatchObject({
      requestsTotal: 0,
      requestsActive: 0,
      serverErrorsTotal: 0,
      serverErrorRatePercent: 0,
      averageDurationMs: 0,
    });
  });

  it('按状态码汇总请求并计算错误率与平均耗时', () => {
    service.requestStarted();
    service.requestCompleted(200, 10);
    service.requestStarted();
    service.requestCompleted(404, 20);
    service.requestStarted();
    service.requestCompleted(500, 30);

    expect(service.getSnapshot().http).toEqual({
      requestsTotal: 3,
      requestsActive: 0,
      responsesByStatus: {
        '2xx': 1,
        '3xx': 0,
        '4xx': 1,
        '5xx': 1,
        other: 0,
      },
      serverErrorsTotal: 1,
      serverErrorRatePercent: 33.33,
      averageDurationMs: 20,
    });
  });

  it('正在处理的请求会计入 active', () => {
    service.requestStarted();

    expect(service.getSnapshot().http.requestsActive).toBe(1);
  });

  it('输出 Prometheus 可以抓取的文本格式', () => {
    service.requestStarted();
    service.requestCompleted(200, 250);

    const output = service.getPrometheusText({
      postgres: 'up',
      minio: 'down',
    });

    expect(output).toContain('# TYPE fullstack_http_requests_total counter');
    expect(output).toContain('fullstack_http_requests_total 1');
    expect(output).toContain(
      'fullstack_http_responses_total{status_class="2xx"} 1',
    );
    expect(output).toContain('fullstack_http_request_duration_seconds_sum 0.25');
    expect(output).toContain(
      'fullstack_dependency_up{dependency="postgres"} 1',
    );
    expect(output).toContain(
      'fullstack_dependency_up{dependency="minio"} 0',
    );
  });
});
