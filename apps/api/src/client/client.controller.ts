import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request as ExpressRequest, Response } from 'express';
import {
  clientFileParamsSchema,
  clientItemParamsSchema,
  clientTokenSchema,
  clientVerifySchema,
  type ClientLinkInfo,
  type ClientView,
} from '@docrequest/shared';
import type { z } from 'zod';
import { env } from '../config/env.js';
import { Public } from '../common/decorators.js';
import { RateLimit } from '../common/rate-limit.js';
import { ClientService, type UploadedBlob } from './client.service.js';

/**
 * Client routes are public (clients have no account). The link, the emailed code
 * and a session bound to one request are checked in ClientService on every call.
 */
@Controller('client')
@Public()
export class ClientController {
  constructor(private readonly client: ClientService) {}

  @Post('open')
  @HttpCode(200)
  @RateLimit({ name: 'client-open', limit: 60, windowSec: 600, by: ['ip'] })
  open(
    @Body({ schema: clientTokenSchema }) body: z.infer<typeof clientTokenSchema>,
    @Req() req: ExpressRequest,
  ): Promise<ClientLinkInfo> {
    return this.client.open(body.token, req);
  }

  @Post('code')
  @HttpCode(204)
  @RateLimit({ name: 'client-code', limit: 10, windowSec: 900, by: ['ip'] })
  code(
    @Body({ schema: clientTokenSchema }) body: z.infer<typeof clientTokenSchema>,
  ): Promise<void> {
    return this.client.sendCode(body.token);
  }

  @Post('verify')
  @HttpCode(204)
  @RateLimit({ name: 'client-verify', limit: 20, windowSec: 900, by: ['ip'] })
  verify(
    @Body({ schema: clientVerifySchema }) body: z.infer<typeof clientVerifySchema>,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    return this.client.verify(body.token, body.code, res);
  }

  @Get('request')
  view(@Req() req: ExpressRequest): Promise<ClientView> {
    return this.client.view(req);
  }

  @Post('items/:itemId/files')
  @RateLimit({ name: 'client-upload', limit: 60, windowSec: 3600, by: ['ip'] })
  // No storage option: multer keeps the upload in memory; it's encrypted before anything is written.
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1, fields: 0 },
    }),
  )
  upload(
    @Param({ schema: clientItemParamsSchema }) p: z.infer<typeof clientItemParamsSchema>,
    @UploadedFile() file: UploadedBlob | undefined,
    @Req() req: ExpressRequest,
  ): Promise<ClientView> {
    return this.client.upload(req, p.itemId, file);
  }

  @Delete('files/:fileId')
  removeFile(
    @Param({ schema: clientFileParamsSchema }) p: z.infer<typeof clientFileParamsSchema>,
    @Req() req: ExpressRequest,
  ): Promise<ClientView> {
    return this.client.removeFile(req, p.fileId);
  }
}
