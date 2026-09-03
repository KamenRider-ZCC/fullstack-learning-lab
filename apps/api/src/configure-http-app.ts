import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ApiExceptionFilter } from './common/api-exception.filter.js';

export function configureHttpApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({
    forbidNonWhitelisted: true,
    transform: true,
    whitelist: true,
  }));
  app.useGlobalFilters(new ApiExceptionFilter());
}
