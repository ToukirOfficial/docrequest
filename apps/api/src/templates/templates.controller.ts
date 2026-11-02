import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import {
  saveTemplateSchema,
  templateParamsSchema,
  workspaceParamsSchema,
  type SaveTemplateInput,
  type Template,
} from '@docrequest/shared';
import type { z } from 'zod';
import {
  CurrentMember,
  CurrentUser,
  Roles,
  type AuthUser,
  type WorkspaceMember,
} from '../common/decorators.js';
import { TemplatesService } from './templates.service.js';

type TemplateParams = z.infer<typeof templateParamsSchema>;

/** Everyone in the workspace can read templates; Owners and Admins change them. */
@Controller('w/:workspaceId/templates')
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get()
  list(
    @Param({ schema: workspaceParamsSchema }) _p: unknown,
    @CurrentMember() member: WorkspaceMember,
  ): Promise<Template[]> {
    return this.templates.list(member);
  }

  @Get(':templateId')
  get(
    @Param({ schema: templateParamsSchema }) p: TemplateParams,
    @CurrentMember() member: WorkspaceMember,
  ): Promise<Template> {
    return this.templates.get(member, p.templateId);
  }

  @Post()
  @Roles('OWNER', 'ADMIN')
  create(
    @Param({ schema: workspaceParamsSchema }) _p: unknown,
    @Body({ schema: saveTemplateSchema }) body: SaveTemplateInput,
    @CurrentMember() member: WorkspaceMember,
    @CurrentUser() user: AuthUser,
  ): Promise<Template> {
    return this.templates.create(member, user, body);
  }

  @Put(':templateId')
  @Roles('OWNER', 'ADMIN')
  update(
    @Param({ schema: templateParamsSchema }) p: TemplateParams,
    @Body({ schema: saveTemplateSchema }) body: SaveTemplateInput,
    @CurrentMember() member: WorkspaceMember,
    @CurrentUser() user: AuthUser,
  ): Promise<Template> {
    return this.templates.update(member, user, p.templateId, body);
  }

  @Delete(':templateId')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(204)
  remove(
    @Param({ schema: templateParamsSchema }) p: TemplateParams,
    @CurrentMember() member: WorkspaceMember,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    return this.templates.remove(member, user, p.templateId);
  }
}
