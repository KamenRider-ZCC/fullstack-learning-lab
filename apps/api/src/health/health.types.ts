export interface HealthResponse {
  status: 'ok';
  service: 'fullstack-learning-api';
  serverTime: string;
  version: string;
}

export type DependencyStatus = 'up' | 'down';

export interface DependencyChecks {
  postgres: DependencyStatus;
  minio: DependencyStatus;
}

export interface ReadinessResponse extends HealthResponse {
  checks: DependencyChecks;
}
