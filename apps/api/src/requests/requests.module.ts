import { Module } from '@nestjs/common';
import { RequestsController } from './requests.controller.js';
import { RequestsService } from './requests.service.js';
import { TemplatesController } from '../templates/templates.controller.js';
import { TemplatesService } from '../templates/templates.service.js';

@Module({
  controllers: [RequestsController, TemplatesController],
  providers: [RequestsService, TemplatesService],
  exports: [RequestsService],
})
export class RequestsModule {}
