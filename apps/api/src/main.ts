import { Logger } from '@nestjs/common';
import { env } from './config/env.js';
import { createApp } from './app.factory.js';

const app = await createApp();
await app.listen(env.API_PORT);
new Logger('Bootstrap').log(`API listening on port ${env.API_PORT}`);
