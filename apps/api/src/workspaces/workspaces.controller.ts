import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import {
  createInviteSchema,
  inviteParamsSchema,
  memberParamsSchema,
  updateMemberSchema,
  updateSettingsSchema,
  workspaceParamsSchema,
  type CreateInviteInput,
  type Member,
  type PendingInvite,
  type UpdateMemberInput,
  type UpdateSettingsInput,
  type WorkspaceSettings,
} from '@docrequest/shared';
import { z } from 'zod';
import {
  CurrentMember,
  CurrentUser,
  Roles,
  type AuthUser,
  type WorkspaceMember,
} from '../common/decorators.js';
import { WorkspacesService } from './workspaces.service.js';

@Controller('w/:workspaceId')
@Roles('OWNER', 'ADMIN')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get('settings')
  settings(
    @Param({ schema: workspaceParamsSchema }) _p: unknown,
    @CurrentMember() member: WorkspaceMember,
  ): Promise<WorkspaceSettings> {
    return this.workspaces.getSettings(member);
  }

  @Patch('settings')
  updateSettings(
    @Param({ schema: workspaceParamsSchema }) _p: unknown,
    @Body({ schema: updateSettingsSchema }) body: UpdateSettingsInput,
    @CurrentMember() member: WorkspaceMember,
    @CurrentUser() user: AuthUser,
  ): Promise<WorkspaceSettings> {
    return this.workspaces.updateSettings(member, user, body);
  }

  @Get('members')
  members(
    @Param({ schema: workspaceParamsSchema }) _p: unknown,
    @CurrentMember() member: WorkspaceMember,
  ): Promise<Member[]> {
    return this.workspaces.listMembers(member);
  }

  @Patch('members/:memberId')
  updateMember(
    @Param({ schema: memberParamsSchema }) params: z.infer<typeof memberParamsSchema>,
    @Body({ schema: updateMemberSchema }) body: UpdateMemberInput,
    @CurrentMember() member: WorkspaceMember,
    @CurrentUser() user: AuthUser,
  ): Promise<Member> {
    return this.workspaces.updateMember(member, user, params.memberId, body);
  }

  @Delete('members/:memberId')
  @HttpCode(204)
  removeMember(
    @Param({ schema: memberParamsSchema }) params: z.infer<typeof memberParamsSchema>,
    @CurrentMember() member: WorkspaceMember,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    return this.workspaces.removeMember(member, user, params.memberId);
  }

  @Get('invites')
  invites(
    @Param({ schema: workspaceParamsSchema }) _p: unknown,
    @CurrentMember() member: WorkspaceMember,
  ): Promise<PendingInvite[]> {
    return this.workspaces.listInvites(member);
  }

  @Post('invites')
  createInvite(
    @Param({ schema: workspaceParamsSchema }) _p: unknown,
    @Body({ schema: createInviteSchema }) body: CreateInviteInput,
    @CurrentMember() member: WorkspaceMember,
    @CurrentUser() user: AuthUser,
  ): Promise<PendingInvite> {
    return this.workspaces.createInvite(member, user, body);
  }

  @Delete('invites/:inviteId')
  @HttpCode(204)
  revokeInvite(
    @Param({ schema: inviteParamsSchema }) params: z.infer<typeof inviteParamsSchema>,
    @CurrentMember() member: WorkspaceMember,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    return this.workspaces.revokeInvite(member, user, params.inviteId);
  }
}
