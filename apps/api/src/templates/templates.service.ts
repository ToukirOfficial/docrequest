import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BUILTIN_TEMPLATES,
  type SaveTemplateInput,
  type Template,
  saveTemplateSchema,
} from '@docrequest/shared';
import type { z } from 'zod';
import { PrismaService } from '../common/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser, WorkspaceMember } from '../common/decorators.js';

type SaveInput = z.output<typeof saveTemplateSchema>;

@Injectable()
export class TemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Built-in templates first, then the workspace's own, newest first. */
  async list(member: WorkspaceMember): Promise<Template[]> {
    const own = await this.prisma.template.findMany({
      where: { workspaceId: member.workspaceId },
      include: { items: { orderBy: { position: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    });
    return [...BUILTIN_TEMPLATES, ...own.map(toTemplate)];
  }

  async get(member: WorkspaceMember, templateId: string): Promise<Template> {
    const builtin = BUILTIN_TEMPLATES.find((t) => t.id === templateId);
    if (builtin) return builtin;
    return toTemplate(await this.find(member, templateId));
  }

  async create(
    member: WorkspaceMember,
    user: AuthUser,
    input: SaveTemplateInput,
  ): Promise<Template> {
    const data = input as SaveInput;
    const t = await this.prisma.$transaction(async (tx) => {
      const created = await tx.template.create({
        data: {
          workspaceId: member.workspaceId,
          name: data.name,
          items: { create: data.items.map((i, position) => ({ ...i, position })) },
        },
        include: { items: { orderBy: { position: 'asc' } } },
      });
      await this.audit.log(
        {
          workspaceId: member.workspaceId,
          actorType: 'USER',
          actorId: user.id,
          action: 'template.created',
          entityType: 'template',
          entityId: created.id,
        },
        tx,
      );
      return created;
    });
    return toTemplate(t);
  }

  async update(
    member: WorkspaceMember,
    user: AuthUser,
    templateId: string,
    input: SaveTemplateInput,
  ): Promise<Template> {
    this.denyBuiltin(templateId);
    const data = input as SaveInput;
    const existing = await this.find(member, templateId);
    const t = await this.prisma.$transaction(async (tx) => {
      await tx.templateItem.deleteMany({ where: { templateId: existing.id } });
      const updated = await tx.template.update({
        where: { id: existing.id },
        data: {
          name: data.name,
          items: { create: data.items.map((i, position) => ({ ...i, position })) },
        },
        include: { items: { orderBy: { position: 'asc' } } },
      });
      await this.audit.log(
        {
          workspaceId: member.workspaceId,
          actorType: 'USER',
          actorId: user.id,
          action: 'template.updated',
          entityType: 'template',
          entityId: existing.id,
        },
        tx,
      );
      return updated;
    });
    return toTemplate(t);
  }

  async remove(member: WorkspaceMember, user: AuthUser, templateId: string): Promise<void> {
    this.denyBuiltin(templateId);
    const existing = await this.find(member, templateId);
    await this.prisma.$transaction(async (tx) => {
      await tx.template.delete({ where: { id: existing.id } });
      await this.audit.log(
        {
          workspaceId: member.workspaceId,
          actorType: 'USER',
          actorId: user.id,
          action: 'template.deleted',
          entityType: 'template',
          entityId: existing.id,
        },
        tx,
      );
    });
  }

  private denyBuiltin(templateId: string): void {
    if (templateId.startsWith('builtin-')) {
      throw new ForbiddenException('Built-in templates can’t be changed. Make a copy to edit it.');
    }
  }

  /** Scoped by workspace: another workspace's template is "not found". */
  private async find(member: WorkspaceMember, templateId: string) {
    const t = await this.prisma.template.findFirst({
      where: { id: templateId, workspaceId: member.workspaceId },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    if (!t) throw new NotFoundException('Template not found');
    return t;
  }
}

function toTemplate(t: {
  id: string;
  name: string;
  updatedAt: Date;
  items: {
    title: string;
    helpText: string;
    required: boolean;
    allowedTypes: Template['items'][number]['allowedTypes'];
  }[];
}): Template {
  return {
    id: t.id,
    name: t.name,
    builtIn: false,
    usedBy: null,
    updatedAt: t.updatedAt.toISOString(),
    items: t.items.map((i) => ({
      title: i.title,
      helpText: i.helpText,
      required: i.required,
      allowedTypes: i.allowedTypes,
    })),
  };
}
