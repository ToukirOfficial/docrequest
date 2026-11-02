import { Body, Controller, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import {
  acceptInviteSchema,
  inviteTokenParamsSchema,
  type AcceptInviteInput,
  type InvitePreview,
} from '@docrequest/shared';
import { z } from 'zod';
import { Public, type AppRequest } from '../common/decorators.js';
import { RateLimit } from '../common/rate-limit.js';
import { WorkspacesService } from './workspaces.service.js';

/** Public: the person opening an invite link may not have an account yet. */
@Controller('invites/:token')
@Public()
@RateLimit({ name: 'invite', limit: 30, windowSec: 15 * 60, by: ['ip'] })
export class InvitesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get()
  preview(
    @Param({ schema: inviteTokenParamsSchema }) params: z.infer<typeof inviteTokenParamsSchema>,
  ): Promise<InvitePreview> {
    return this.workspaces.previewInvite(params.token);
  }

  @Post('accept')
  @HttpCode(204)
  accept(
    @Param({ schema: inviteTokenParamsSchema }) params: z.infer<typeof inviteTokenParamsSchema>,
    @Body({ schema: acceptInviteSchema }) body: AcceptInviteInput,
    @Req() req: AppRequest,
  ): Promise<void> {
    return this.workspaces.acceptInvite(params.token, body, req.user);
  }
}
