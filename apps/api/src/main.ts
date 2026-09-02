import 'dotenv/config';
import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ApiExceptionFilter } from './common/api-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT || 3000);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({
    forbidNonWhitelisted: true,
    transform: true,
    whitelist: true,
  }));
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');
  Logger.log(`API running at http://localhost:${port}/api`, 'Bootstrap');
}

bootstrap().catch((error: unknown) => {
  Logger.error(error, 'API failed to start', 'Bootstrap');
  process.exitCode = 1;
});
