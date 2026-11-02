import { Body, Controller, Get, HttpCode, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import {
  auditQuerySchema,
  exportParamsSchema,
  fileParamsSchema,
  fileQuerySchema,
  itemParamsSchema,
  rejectItemSchema,
  requestParamsSchema,
  type AuditPage,
  type ExportInfo,
  type RejectItemInput,
  type RequestDetail,
} from '@docrequest/shared';
import type { z } from 'zod';
import {
  CurrentMember,
  CurrentUser,
  Roles,
  type AuthUser,
  type WorkspaceMember,
} from '../common/decorators.js';
import { ReviewService, type FileDownload } from './review.service.js';

type ItemParams = z.infer<typeof itemParamsSchema>;

@Controller('w/:workspaceId')
export class ReviewController {
  constructor(private readonly review: ReviewService) {}

  @Post('requests/:requestId/items/:itemId/accept')
  @HttpCode(200)
  accept(
    @Param({ schema: itemParamsSchema }) p: ItemParams,
    @CurrentMember() m: WorkspaceMember,
    @CurrentUser() u: AuthUser,
  ): Promise<RequestDetail> {
    return this.review.accept(m, u, p.requestId, p.itemId);
  }

  @Post('requests/:requestId/items/:itemId/reject')
  @HttpCode(200)
  reject(
    @Param({ schema: itemParamsSchema }) p: ItemParams,
    @Body({ schema: rejectItemSchema }) body: RejectItemInput,
    @CurrentMember() m: WorkspaceMember,
    @CurrentUser() u: AuthUser,
  ): Promise<RequestDetail> {
    return this.review.reject(m, u, p.requestId, p.itemId, body.reason);
  }

  /** Preview (inline) or download. Audited either way. */
  @Get('files/:fileId')
  async file(
    @Param({ schema: fileParamsSchema }) p: z.infer<typeof fileParamsSchema>,
    @Query({ schema: fileQuerySchema }) q: z.infer<typeof fileQuerySchema>,
    @CurrentMember() m: WorkspaceMember,
    @CurrentUser() u: AuthUser,
    @Res() res: Response,
  ): Promise<void> {
    sendFile(res, await this.review.file(m, u, p.fileId, q.download === '1'), q.download === '1');
  }

  @Post('requests/:requestId/export')
  @HttpCode(202)
  createExport(
    @Param({ schema: requestParamsSchema }) p: z.infer<typeof requestParamsSchema>,
    @CurrentMember() m: WorkspaceMember,
    @CurrentUser() u: AuthUser,
  ): Promise<ExportInfo> {
    return this.review.createExport(m, u, p.requestId);
  }

  @Get('exports/:exportId')
  getExport(
    @Param({ schema: exportParamsSchema }) p: z.infer<typeof exportParamsSchema>,
    @CurrentMember() m: WorkspaceMember,
  ): Promise<ExportInfo> {
    return this.review.getExport(m, p.exportId);
  }

  @Get('exports/:exportId/download')
  async downloadExport(
    @Param({ schema: exportParamsSchema }) p: z.infer<typeof exportParamsSchema>,
    @CurrentMember() m: WorkspaceMember,
    @CurrentUser() u: AuthUser,
    @Res() res: Response,
  ): Promise<void> {
    sendFile(res, await this.review.downloadExport(m, u, p.exportId), true);
  }

  @Get('audit')
  @Roles('OWNER', 'ADMIN')
  auditLog(
    @Param({ schema: exportParamsSchema.pick({ workspaceId: true }) }) _p: unknown,
    @Query({ schema: auditQuerySchema }) q: z.infer<typeof auditQuerySchema>,
    @CurrentMember() m: WorkspaceMember,
  ): Promise<AuditPage> {
    return this.review.auditLog(m, q.page);
  }
}

/**
 * Serves decrypted bytes with headers that stop the browser treating them as anything else.
 * Only PDFs and re-encoded JPEG/PNG are ever stored, never HTML or SVG.
 * PDFs aren't sandboxed because browsers' built-in PDF viewers stop working under a sandbox.
 */
function sendFile(res: Response, f: FileDownload, attachment: boolean): void {
  const isPdf = f.mimeType === 'application/pdf';
  res.setHeader('Content-Type', f.mimeType);
  res.setHeader('Content-Length', String(f.body.length));
  res.setHeader(
    'Content-Disposition',
    `${attachment ? 'attachment' : 'inline'}; filename="${f.fileName}"; filename*=UTF-8''${encodeURIComponent(f.fileName)}`,
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader(
    'Content-Security-Policy',
    isPdf
      ? "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; object-src 'self'"
      : "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
  );
  res.end(f.body);
}
