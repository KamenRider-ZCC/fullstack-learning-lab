import { Body, Controller, Get, Inject, Param, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { SaveScoreDto } from './dto/save-score.dto.js';
import { ReviewService } from './review.service.js';

@Controller('review-items')
@UseGuards(JwtAuthGuard)
export class ReviewController {
  constructor(@Inject(ReviewService) private readonly reviewService: ReviewService) {}

  @Get(':reviewItemId')
  getDetail(
    @Param('reviewItemId') reviewItemId: string,
    @Query('bidderId') bidderId = 'demo-bidder',
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviewService.getDetail(reviewItemId, bidderId, user.id);
  }

  @Put(':reviewItemId/score')
  @Roles('EXPERT')
  @UseGuards(RolesGuard)
  saveScore(
    @Param('reviewItemId') reviewItemId: string,
    @Body() body: SaveScoreDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviewService.saveScore(
      reviewItemId,
      body.bidderId,
      user.id,
      body.score,
      body.feedback || '',
    );
  }
}
