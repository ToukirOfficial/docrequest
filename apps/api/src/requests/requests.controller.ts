import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  createRequestSchema,
  listRequestsQuerySchema,
  replaceItemsSchema,
  requestParamsSchema,
  updateRequestSchema,
  workspaceParamsSchema,
  type CreateRequestInput,
  type Dashboard,
  type ListRequestsQuery,
  type ReplaceItemsInput,
  type RequestDetail,
  type RequestList,
  type UpdateRequestInput,
} from '@docrequest/shared';
import type { z } from 'zod';
import {
  CurrentMember,
  CurrentUser,
  type AuthUser,
  type WorkspaceMember,
} from '../common/decorators.js';
import { RequestsService } from './requests.service.js';

type RequestParams = z.infer<typeof requestParamsSchema>;

/** Every role (Owner, Admin, Staff) creates and manages requests in its own workspace. */
@Controller('w/:workspaceId')
export class RequestsController {
  constructor(private readonly requests: RequestsService) {}

  @Get('dashboard')
  dashboard(
    @Param({ schema: workspaceParamsSchema }) _p: unknown,
    @CurrentMember() m: WorkspaceMember,
  ): Promise<Dashboard> {
    return this.requests.dashboard(m);
  }

  @Get('requests')
  list(
    @Param({ schema: workspaceParamsSchema }) _p: unknown,
    @Query({ schema: listRequestsQuerySchema }) q: ListRequestsQuery,
    @CurrentMember() m: WorkspaceMember,
  ): Promise<RequestList> {
    return this.requests.list(m, q);
  }

  @Post('requests')
  create(
    @Param({ schema: workspaceParamsSchema }) _p: unknown,
    @Body({ schema: createRequestSchema }) body: CreateRequestInput,
    @CurrentMember() m: WorkspaceMember,
    @CurrentUser() u: AuthUser,
  ): Promise<RequestDetail> {
    return this.requests.create(m, u, body);
  }

  @Get('requests/:requestId')
  get(
    @Param({ schema: requestParamsSchema }) p: RequestParams,
    @CurrentMember() m: WorkspaceMember,
  ): Promise<RequestDetail> {
    return this.requests.get(m, p.requestId);
  }

  @Patch('requests/:requestId')
  update(
    @Param({ schema: requestParamsSchema }) p: RequestParams,
    @Body({ schema: updateRequestSchema }) body: UpdateRequestInput,
    @CurrentMember() m: WorkspaceMember,
    @CurrentUser() u: AuthUser,
  ): Promise<RequestDetail> {
    return this.requests.update(m, u, p.requestId, body);
  }

  @Put('requests/:requestId/items')
  replaceItems(
    @Param({ schema: requestParamsSchema }) p: RequestParams,
    @Body({ schema: replaceItemsSchema }) body: ReplaceItemsInput,
    @CurrentMember() m: WorkspaceMember,
    @CurrentUser() u: AuthUser,
  ): Promise<RequestDetail> {
    return this.requests.replaceItems(m, u, p.requestId, body);
  }

  @Post('requests/:requestId/send')
  @HttpCode(200)
  send(
    @Param({ schema: requestParamsSchema }) p: RequestParams,
    @CurrentMember() m: WorkspaceMember,
    @CurrentUser() u: AuthUser,
  ): Promise<RequestDetail> {
    return this.requests.send(m, u, p.requestId);
  }

  @Post('requests/:requestId/cancel')
  @HttpCode(200)
  cancel(
    @Param({ schema: requestParamsSchema }) p: RequestParams,
    @CurrentMember() m: WorkspaceMember,
    @CurrentUser() u: AuthUser,
  ): Promise<RequestDetail> {
    return this.requests.cancel(m, u, p.requestId);
  }

  @Delete('requests/:requestId')
  @HttpCode(204)
  remove(
    @Param({ schema: requestParamsSchema }) p: RequestParams,
    @CurrentMember() m: WorkspaceMember,
    @CurrentUser() u: AuthUser,
  ): Promise<void> {
    return this.requests.remove(m, u, p.requestId);
  }
}
