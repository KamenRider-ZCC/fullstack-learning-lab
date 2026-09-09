export interface HealthResponse {
  status: 'ok';
  service: 'fullstack-learning-api';
  serverTime: string;
  version: string;
}

export type DependencyStatus = 'up' | 'down';

export interface ReadinessResponse extends HealthResponse {
  checks: {
    postgres: DependencyStatus;
    minio: DependencyStatus;
  };
}
