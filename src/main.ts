import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module.js';
import type { EnvironmentVariables } from './config/environment.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = app.get(Logger);
  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  app.useLogger(logger);
  app.enableShutdownHooks();

  const port = config.get('PORT', { infer: true });
  await app.listen(port);

  logger.log(`RailBridge foundation is listening on port ${port}`, 'Bootstrap');
}

void bootstrap();
