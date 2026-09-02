import { BadRequestException, Inject, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import type { ExpertScore, ReviewItem } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ReviewDetailResponse } from './review.types.js';

const DEMO_REVIEW_ITEM_ID = 'review-progress-plan';

@Injectable()
export class ReviewService implements OnModuleInit {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.prisma.reviewItem.upsert({
      where: { id: DEMO_REVIEW_ITEM_ID },
      update: {},
      create: {
        id: DEMO_REVIEW_ITEM_ID,
        title: '进度计划',
        description: '进度计划全面合理得 4 分，一般得 2～3 分，较差得 0～1 分。',
        maxScore: 4,
        aiScore: 3.5,
      },
    });
  }

  async getDetail(reviewItemId: string, bidderId: string, expertId: string) {
    const item = await this.findItem(reviewItemId);
    const score = await this.prisma.expertScore.findUnique({
      where: {
        reviewItemId_bidderId_expertId: { reviewItemId, bidderId, expertId },
      },
    });
    return this.toResponse(item, score);
  }

  async saveScore(
    reviewItemId: string,
    bidderId: string,
    expertId: string,
    score: number,
    feedback: string,
  ) {
    const item = await this.findItem(reviewItemId);
    if (score < 0 || score > item.maxScore) {
      throw new BadRequestException(`分数必须在 0～${item.maxScore} 之间`);
    }
    if (Math.round(score * 2) !== score * 2) {
      throw new BadRequestException('分数必须按 0.5 分递增');
    }

    const savedScore = await this.prisma.expertScore.upsert({
      where: {
        reviewItemId_bidderId_expertId: { reviewItemId, bidderId, expertId },
      },
      update: { score, feedback },
      create: { reviewItemId, bidderId, expertId, score, feedback },
    });
    return this.toResponse(item, savedScore);
  }

  private async findItem(reviewItemId: string) {
    const item = await this.prisma.reviewItem.findUnique({ where: { id: reviewItemId } });
    if (!item) throw new NotFoundException('评审项不存在');
    return item;
  }

  private toResponse(item: ReviewItem, score: ExpertScore | null): ReviewDetailResponse {
    return {
      reviewItem: {
        id: item.id,
        title: item.title,
        description: item.description,
        maxScore: item.maxScore,
        aiScore: item.aiScore,
      },
      score: score
        ? {
            score: score.score,
            feedback: score.feedback || '',
            updatedAt: score.updatedAt.toISOString(),
          }
        : null,
    };
  }
}
