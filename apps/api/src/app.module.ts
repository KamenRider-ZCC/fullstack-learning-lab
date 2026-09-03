import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { DocumentModule } from './document/document.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ReviewModule } from './review/review.module.js';

@Module({
  imports: [PrismaModule, HealthModule, AuthModule, ReviewModule, DocumentModule],
})
export class AppModule {}
