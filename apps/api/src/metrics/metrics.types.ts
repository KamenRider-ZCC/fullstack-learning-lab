export interface HttpStatusCounts {
  '2xx': number;
  '3xx': number;
  '4xx': number;
  '5xx': number;
  other: number;
}

export interface MetricsSnapshot {
  generatedAt: string;
  processUptimeSeconds: number;
  http: {
    requestsTotal: number;
    requestsActive: number;
    responsesByStatus: HttpStatusCounts;
    serverErrorsTotal: number;
    serverErrorRatePercent: number;
    averageDurationMs: number;
  };
}
