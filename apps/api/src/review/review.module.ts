import { Module } from '@nestjs/common';
import { RequestsModule } from '../requests/requests.module.js';
import { ReviewController } from './review.controller.js';
import { ReviewService } from './review.service.js';

@Module({ imports: [RequestsModule], controllers: [ReviewController], providers: [ReviewService] })
export class ReviewModule {}
