import { Body, Controller, Get, Inject, Param, Put, Query } from '@nestjs/common';
import { SaveScoreDto } from './dto/save-score.dto.js';
import { ReviewService } from './review.service.js';

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
    @Body() body: SaveScoreDto,
  ) {
    return this.reviewService.saveScore(
      reviewItemId,
      body.bidderId,
      body.expertId,
      body.score,
      body.feedback || '',
    );
  }
}
