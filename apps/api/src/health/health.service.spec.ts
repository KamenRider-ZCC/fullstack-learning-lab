import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_HEALTH } from '../document/storage-health.port.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  const prisma = { $queryRaw: vi.fn() };
  const storageHealth = { checkHealth: vi.fn() };
  let service: HealthService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: prisma },
        { provide: STORAGE_HEALTH, useValue: storageHealth },
      ],
    }).compile();
    service = moduleRef.get(HealthService);
  });

  it('存活检查不访问外部依赖', () => {
    expect(service.getLiveness()).toMatchObject({ status: 'ok' });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(storageHealth.checkHealth).not.toHaveBeenCalled();
  });

  it('数据库和 MinIO 都可用时报告就绪', async () => {
    prisma.$queryRaw.mockResolvedValue([{ result: 1 }]);
    storageHealth.checkHealth.mockResolvedValue(undefined);

    await expect(service.getReadiness()).resolves.toMatchObject({
      status: 'ok',
      checks: { postgres: 'up', minio: 'up' },
    });
  });

  it('数据库不可用时拒绝接收流量', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('database unavailable'));
    storageHealth.checkHealth.mockResolvedValue(undefined);

    await expect(service.getReadiness()).rejects.toMatchObject({
      response: {
        code: 'SERVICE_NOT_READY',
        details: { postgres: 'down', minio: 'up' },
      },
    });
  });

  it('MinIO 不可用时拒绝接收流量', async () => {
    prisma.$queryRaw.mockResolvedValue([{ result: 1 }]);
    storageHealth.checkHealth.mockRejectedValue(new Error('MinIO unavailable'));

    await expect(service.getReadiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(service.getReadiness()).rejects.toMatchObject({
      response: {
        details: { postgres: 'up', minio: 'down' },
      },
    });
  });
});
