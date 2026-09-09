import { MiddlewareConsumer, Module } from '@nestjs/common';
import type { NestModule } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { DocumentModule } from './document/document.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ReviewModule } from './review/review.module.js';
import { RequestIdMiddleware } from './common/request-id.middleware.js';
import { MetricsModule } from './metrics/metrics.module.js';

@Module({
  imports: [
    PrismaModule,
    MetricsModule,
    HealthModule,
    AuthModule,
    ReviewModule,
    DocumentModule,
  ],
  providers: [RequestIdMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
