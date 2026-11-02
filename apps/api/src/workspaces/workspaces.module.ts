import { Module } from '@nestjs/common';
import { InvitesController } from './invites.controller.js';
import { WorkspacesController } from './workspaces.controller.js';
import { WorkspacesService } from './workspaces.service.js';

@Module({
  controllers: [WorkspacesController, InvitesController],
  providers: [WorkspacesService],
})
export class WorkspacesModule {}
