import { Module } from '@nestjs/common';
import { DocumentModule } from '../document/document.module.js';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

@Module({
  imports: [DocumentModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
