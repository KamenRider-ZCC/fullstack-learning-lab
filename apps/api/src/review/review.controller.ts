import { BadRequestException, Body, Controller, Get, Inject, Param, Put, Query } from '@nestjs/common';
import { ReviewService } from './review.service.js';
import type { SaveScoreBody } from './review.types.js';

@Controller('review-items')
export class ReviewController {
  constructor(@Inject(ReviewService) private readonly reviewService: ReviewService) {}

  @Get(':reviewItemId')
  getDetail(
    @Param('reviewItemId') reviewItemId: string,
    @Query('bidderId') bidderId = 'demo-bidder',
    @Query('expertId') expertId = 'demo-expert',
  ) {
    return this.reviewService.getDetail(reviewItemId, bidderId, expertId);
  }

  @Put(':reviewItemId/score')
  saveScore(
    @Param('reviewItemId') reviewItemId: string,
    @Body() body: SaveScoreBody,
  ) {
    if (typeof body.bidderId !== 'string' || typeof body.expertId !== 'string') {
      throw new BadRequestException('bidderId 和 expertId 必须是字符串');
    }
    if (typeof body.score !== 'number' || !Number.isFinite(body.score)) {
      throw new BadRequestException('score 必须是有效数字');
    }
    if (body.feedback != null && typeof body.feedback !== 'string') {
      throw new BadRequestException('feedback 必须是字符串');
    }
    return this.reviewService.saveScore(
      reviewItemId,
      body.bidderId,
      body.expertId,
      body.score,
      body.feedback || '',
    );
  }
}
