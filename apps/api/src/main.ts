import { Logger } from '@nestjs/common';
import { env } from './config/env.js';
import { createApp } from './app.factory.js';

const app = await createApp();
await app.listen(env.API_PORT, env.API_HOST);
new Logger('Bootstrap').log(`API listening on ${env.API_HOST}:${env.API_PORT}`);
