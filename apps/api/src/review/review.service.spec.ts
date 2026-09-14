import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { FEEDBACK_MAX_LENGTH, ReviewService } from './review.service.js';

const reviewItem = {
  id: 'review-progress-plan',
  title: '进度计划',
  description: '进度计划评分标准',
  maxScore: 4,
  aiScore: 3.5,
  createdAt: new Date('2026-09-01T08:00:00.000Z'),
  updatedAt: new Date('2026-09-01T08:00:00.000Z'),
};

function createPrismaMock() {
  return {
    reviewItem: { findUnique: vi.fn() },
    expertScore: { upsert: vi.fn() },
  };
}

describe('ReviewService 评分说明规则', () => {
  let moduleRef: TestingModule;
  let service: ReviewService;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prisma = createPrismaMock();
    prisma.reviewItem.findUnique.mockResolvedValue(reviewItem);
    moduleRef = await Test.createTestingModule({
      providers: [
        ReviewService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(ReviewService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('拒绝只有空格的评分说明，不写入数据库', async () => {
    await expect(service.saveScore(
      reviewItem.id,
      'bidder-1',
      'expert-1',
      3,
      '   ',
    )).rejects.toMatchObject({
      response: { code: 'FEEDBACK_REQUIRED' },
    });

    expect(prisma.expertScore.upsert).not.toHaveBeenCalled();
  });

  it('拒绝超过 200 个字符的评分说明', async () => {
    await expect(service.saveScore(
      reviewItem.id,
      'bidder-1',
      'expert-1',
      3,
      '字'.repeat(FEEDBACK_MAX_LENGTH + 1),
    )).rejects.toMatchObject({
      response: { code: 'FEEDBACK_TOO_LONG' },
    });

    expect(prisma.expertScore.upsert).not.toHaveBeenCalled();
  });

  it('去除首尾空格后保存，并向前端返回长度限制', async () => {
    prisma.expertScore.upsert.mockResolvedValue({
      id: 'score-1',
      reviewItemId: reviewItem.id,
      bidderId: 'bidder-1',
      expertId: 'expert-1',
      score: 3,
      feedback: '依据充分',
      createdAt: new Date('2026-09-14T08:00:00.000Z'),
      updatedAt: new Date('2026-09-14T08:00:00.000Z'),
    });

    const result = await service.saveScore(
      reviewItem.id,
      'bidder-1',
      'expert-1',
      3,
      '  依据充分  ',
    );

    expect(prisma.expertScore.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: { score: 3, feedback: '依据充分' },
    }));
    expect(result.reviewItem.feedbackMaxLength).toBe(FEEDBACK_MAX_LENGTH);
    expect(result.score?.feedback).toBe('依据充分');
  });
});
