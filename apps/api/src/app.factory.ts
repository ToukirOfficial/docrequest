import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { StandardSchemaValidationPipe, type INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { env } from './config/env.js';
import { AppModule } from './app.module.js';

export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: env.NODE_ENV === 'test' ? false : ['error', 'warn', 'log'],
  });
  app.set('trust proxy', env.TRUST_PROXY);
  app.setGlobalPrefix('api');
  // Origin check (Fetch Metadata + Origin fallback) on every POST/PUT/PATCH/DELETE.
  app.enableCsrfProtection({ trustedOrigins: [new URL(env.WEB_ORIGIN).origin] });
  app.useSecurityHeaders();
  // Validates every @Body/@Query/@Param({ schema }) with the shared Zod schemas.
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  app.useBodyParser('json', { limit: '100kb' });
  app.enableShutdownHooks();
  return app;
}
