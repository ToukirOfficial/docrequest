import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DemoController } from './demo.controller.js';

@Module({ imports: [AuthModule], controllers: [DemoController] })
export class DemoModule {}
