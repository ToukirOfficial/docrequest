import { Module } from '@nestjs/common';
import { ClientController } from './client.controller.js';
import { ClientService } from './client.service.js';

@Module({ controllers: [ClientController], providers: [ClientService] })
export class ClientModule {}
