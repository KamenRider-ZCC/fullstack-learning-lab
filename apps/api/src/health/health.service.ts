import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { STORAGE_HEALTH } from '../document/storage-health.port.js';
import type { StorageHealthPort } from '../document/storage-health.port.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  DependencyStatus,
  HealthResponse,
  ReadinessResponse,
} from './health.types.js';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(STORAGE_HEALTH) private readonly storageHealth: StorageHealthPort,
  ) {}

  getLiveness(): HealthResponse {
    return this.createBaseResponse();
  }

  async getReadiness(): Promise<ReadinessResponse> {
    const [postgresResult, minioResult] = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.storageHealth.checkHealth(),
    ]);
    const checks = {
      postgres: this.toDependencyStatus(postgresResult),
      minio: this.toDependencyStatus(minioResult),
    };

    if (checks.postgres === 'down' || checks.minio === 'down') {
      this.logger.warn(
        `Readiness check failed: postgres=${checks.postgres}, minio=${checks.minio}`,
      );
      throw new ServiceUnavailableException({
        code: 'SERVICE_NOT_READY',
        message: '服务依赖尚未就绪',
        details: checks,
      });
    }

    return { ...this.createBaseResponse(), checks };
  }

  private createBaseResponse(): HealthResponse {
    return {
      status: 'ok',
      service: 'fullstack-learning-api',
      serverTime: new Date().toISOString(),
      version: '1.0.0',
    };
  }

  private toDependencyStatus(result: PromiseSettledResult<unknown>): DependencyStatus {
    return result.status === 'fulfilled' ? 'up' : 'down';
  }
}
