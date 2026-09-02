import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ReviewModule } from './review/review.module.js';

@Module({
  imports: [PrismaModule, HealthModule, ReviewModule],
})
export class AppModule {}
