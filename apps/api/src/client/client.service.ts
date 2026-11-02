import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { Request as ExpressRequest, Response } from 'express';
import { Queue } from 'bullmq';
import type { ClientLinkInfo, ClientView } from '@docrequest/shared';
import { env, isProd } from '../config/env.js';
import { PrismaService } from '../common/prisma.service.js';
import { RedisService } from '../common/redis.service.js';
import { AuditService } from '../audit/audit.service.js';
import { MailService } from '../mail/mail.service.js';
import { mailTemplates } from '../mail/templates.js';
import { hashCode, randomCode, randomToken, safeEqual, sha256 } from '../common/crypto.js';
import { readCookie } from '../common/cookies.js';
import { QUEUE_PREFIX, SCAN_QUEUE, bullConnection, type FileJob } from '../queue/queues.js';
import { detectType } from '../files/detect.js';
import { seal } from '../files/envelope.js';
import { fileStore, newStorageKey } from '../files/storage.js';
import {
  CODE_MAX_ATTEMPTS,
  CODE_TTL_SEC,
  CODES_PER_HOUR,
  SESSION_TTL_SEC,
  type ClientSession,
} from './client.session.js';

export const CLIENT_COOKIE = 'dr_client';

/** The parts of a multer upload we use. The bytes stay in memory until they are encrypted. */
export interface UploadedBlob {
  buffer: Buffer;
  size: number;
}

const ACTIVE = ['SENT', 'IN_PROGRESS'] as const;

/**
 * Everything the client (a member of the public, no account) can do.
 * Proof of identity = the link (stored only as a hash) + a 6-digit code emailed to them.
 * A session is bound to exactly one request.
 */
@Injectable()
export class ClientService {
  readonly scanQueue = new Queue<FileJob>(SCAN_QUEUE, {
    connection: bullConnection(),
    prefix: QUEUE_PREFIX,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      removeOnFail: 100,
    },
  });

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.scanQueue.close();
  }

  /** Finds a request by link token. Unknown, ended or expired links all fail here. */
  private async byToken(token: string) {
    const r = await this.prisma.request.findUnique({
      where: { linkHash: sha256(token) },
      include: { workspace: { select: { name: true } }, _count: { select: { items: true } } },
    });
    if (!r)
      throw new NotFoundException(
        'This link isn’t valid. Check you opened the latest email, or ask for a new link.',
      );
    if (r.status === 'COMPLETE') return { r, complete: true };
    if (
      !ACTIVE.includes(r.status as (typeof ACTIVE)[number]) ||
      !r.linkExpiresAt ||
      r.linkExpiresAt < new Date()
    ) {
      throw new GoneException(
        'This link has expired. Ask the business that sent it for a new one.',
      );
    }
    return { r, complete: false };
  }

  async open(token: string, req: ExpressRequest): Promise<ClientLinkInfo> {
    const { r, complete } = await this.byToken(token);
    const session = await this.readSession(req);
    // Log an open at most once an hour per request, so refreshes don't flood the feed.
    if (!complete && (await this.redis.set(`copened:${r.id}`, '1', 'EX', 3600, 'NX')) === 'OK') {
      await this.audit.log({
        workspaceId: r.workspaceId,
        actorType: 'CLIENT',
        action: 'client.opened',
        entityType: 'request',
        entityId: r.id,
        requestId: r.id,
      });
    }
    return {
      workspaceName: r.workspace.name,
      clientFirstName: firstName(r.clientName),
      itemCount: r._count.items,
      maskedEmail: maskEmail(r.clientEmail),
      signedIn: session?.requestId === r.id,
      complete,
    };
  }

  async sendCode(token: string): Promise<void> {
    const { r, complete } = await this.byToken(token);
    if (complete)
      throw new ConflictException('This request is complete. There’s nothing left to upload.');
    const tokenHash = sha256(token);
    const sent = await this.redis.incr(`ccodes:${tokenHash}`);
    if (sent === 1) await this.redis.expire(`ccodes:${tokenHash}`, 3600);
    if (sent > CODES_PER_HOUR) {
      throw new BadRequestException(
        'Too many codes have been sent. Please wait an hour and try again.',
      );
    }
    const code = randomCode();
    await this.redis
      .multi()
      .del(`ccode:${tokenHash}`)
      .hset(`ccode:${tokenHash}`, {
        requestId: r.id,
        codeHash: hashCode(code, `client:${tokenHash}`),
        attempts: 0,
      })
      .expire(`ccode:${tokenHash}`, CODE_TTL_SEC)
      .exec();
    await this.mail.send(mailTemplates.clientCode(r.clientEmail, r.workspace.name, code));
  }

  /** Max 5 tries per code; then a new code is needed. On success, a session for this one request. */
  async verify(token: string, code: string, res: Response): Promise<void> {
    const { r } = await this.byToken(token);
    const tokenHash = sha256(token);
    const key = `ccode:${tokenHash}`;
    const wrong = new UnauthorizedException(
      'That code is wrong or has expired. Ask for a new code.',
    );
    const attempts = await this.redis.hincrby(key, 'attempts', 1);
    const [requestId, codeHash] = await this.redis.hmget(key, 'requestId', 'codeHash');
    if (!requestId || !codeHash || requestId !== r.id) {
      await this.redis.del(key);
      throw wrong;
    }
    if (attempts > CODE_MAX_ATTEMPTS) {
      await this.redis.del(key);
      throw wrong;
    }
    if (!safeEqual(codeHash, hashCode(code, `client:${tokenHash}`))) {
      throw new UnauthorizedException('That code is wrong. Check the latest email and try again.');
    }
    await this.redis.del(key);
    const sid = randomToken();
    const session: ClientSession = { requestId: r.id, workspaceId: r.workspaceId };
    await this.redis.set(`csess:${sha256(sid)}`, JSON.stringify(session), 'EX', SESSION_TTL_SEC);
    res.cookie(CLIENT_COOKIE, sid, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/api/client',
      maxAge: SESSION_TTL_SEC * 1000,
    });
    await this.audit.log({
      workspaceId: r.workspaceId,
      actorType: 'CLIENT',
      action: 'client.verified',
      entityType: 'request',
      entityId: r.id,
      requestId: r.id,
    });
  }

  private async readSession(req: ExpressRequest): Promise<ClientSession | null> {
    const sid = readCookie(req, CLIENT_COOKIE);
    if (!sid || sid.length > 200) return null;
    const key = `csess:${sha256(sid)}`;
    const raw = await this.redis.get(key);
    if (!raw) return null;
    await this.redis.expire(key, SESSION_TTL_SEC); // sliding: stays signed in while active
    return JSON.parse(raw) as ClientSession;
  }

  /** Every session route goes through here. The session only ever opens its own request. */
  async requireSession(req: ExpressRequest, forWrite: boolean) {
    const s = await this.readSession(req);
    if (!s)
      throw new UnauthorizedException(
        'Your session has ended. Open the link from your email again.',
      );
    const r = await this.prisma.request.findFirst({
      where: { id: s.requestId, workspaceId: s.workspaceId },
      include: { workspace: { select: { name: true } } },
    });
    if (!r)
      throw new UnauthorizedException(
        'Your session has ended. Open the link from your email again.',
      );
    const active =
      ACTIVE.includes(r.status as (typeof ACTIVE)[number]) &&
      !!r.linkExpiresAt &&
      r.linkExpiresAt > new Date();
    if (!active && !(r.status === 'COMPLETE' && !forWrite)) {
      throw new GoneException(
        r.status === 'COMPLETE'
          ? 'This request is complete. There’s nothing left to upload.'
          : 'This link has expired. Ask the business that sent it for a new one.',
      );
    }
    return r;
  }

  async view(req: ExpressRequest): Promise<ClientView> {
    const r = await this.requireSession(req, false);
    return this.toView(r.id, r.workspace.name);
  }

  async upload(
    req: ExpressRequest,
    itemId: string,
    file: UploadedBlob | undefined,
  ): Promise<ClientView> {
    const r = await this.requireSession(req, true);
    if (!file) throw new BadRequestException('Choose a file to upload.');
    // The item must belong to this session's request: never trust the id alone.
    const item = await this.prisma.requestItem.findFirst({
      where: { id: itemId, requestId: r.id },
    });
    if (!item) throw new NotFoundException('That document isn’t part of this request.');
    if (item.status === 'ACCEPTED')
      throw new ConflictException('This document has already been accepted.');

    const detected = await detectType(file.buffer);
    if (!detected || !item.allowedTypes.includes(detected.type)) {
      const allowed = item.allowedTypes.join(', ');
      throw new UnsupportedMediaTypeException(
        `This file type can’t be used here. Please upload ${allowed}.`,
      );
    }

    const sealed = await seal(file.buffer);
    const storageKey = newStorageKey();
    await fileStore().put(storageKey, sealed.ciphertext);
    let fileId: string;
    try {
      fileId = await this.prisma.$transaction(async (tx) => {
        const f = await tx.file.create({
          data: {
            requestItemId: item.id,
            requestId: r.id,
            workspaceId: r.workspaceId,
            storageKey,
            wrappedKey: sealed.wrappedKey,
            iv: sealed.iv,
            authTag: sealed.authTag,
            mimeType: detected.mime,
            size: file.size,
            originalExt: detected.ext,
          },
        });
        await tx.requestItem.update({
          where: { id: item.id },
          data: { status: 'SUBMITTED', rejectReason: null },
        });
        if (r.status === 'SENT')
          await tx.request.update({ where: { id: r.id }, data: { status: 'IN_PROGRESS' } });
        else await tx.request.update({ where: { id: r.id }, data: { updatedAt: new Date() } });
        await this.audit.log(
          {
            workspaceId: r.workspaceId,
            actorType: 'CLIENT',
            action: 'file.uploaded',
            entityType: 'file',
            entityId: f.id,
            requestId: r.id,
          },
          tx,
        );
        return f.id;
      });
    } catch (e) {
      await fileStore().remove(storageKey);
      throw e;
    }
    await this.scanQueue.add('scan', { fileId });
    return this.toView(r.id, r.workspace.name);
  }

  async removeFile(req: ExpressRequest, fileId: string): Promise<ClientView> {
    const r = await this.requireSession(req, true);
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, requestId: r.id, deletedAt: null },
      include: { item: { select: { status: true } } },
    });
    if (!file) throw new NotFoundException('That file isn’t part of this request.');
    if (file.item.status === 'ACCEPTED')
      throw new ConflictException('This document has been accepted, so it can’t be removed.');
    await this.prisma.$transaction(async (tx) => {
      await tx.file.update({ where: { id: file.id }, data: { deletedAt: new Date() } });
      const left = await tx.file.count({
        where: { requestItemId: file.requestItemId, deletedAt: null },
      });
      if (left === 0)
        await tx.requestItem.update({
          where: { id: file.requestItemId },
          data: { status: 'PENDING' },
        });
      await this.audit.log(
        {
          workspaceId: r.workspaceId,
          actorType: 'CLIENT',
          action: 'file.removed',
          entityType: 'file',
          entityId: file.id,
          requestId: r.id,
        },
        tx,
      );
    });
    await fileStore().remove(file.storageKey);
    return this.toView(r.id, r.workspace.name);
  }

  private async toView(requestId: string, workspaceName: string): Promise<ClientView> {
    const r = await this.prisma.request.findUniqueOrThrow({
      where: { id: requestId },
      include: {
        items: {
          orderBy: { position: 'asc' },
          include: { files: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } } },
        },
      },
    });
    return {
      workspaceName,
      clientFirstName: firstName(r.clientName),
      message: r.message,
      dueDate: r.dueDate ? r.dueDate.toISOString().slice(0, 10) : null,
      status: r.status,
      maxUploadMb: env.MAX_UPLOAD_MB,
      items: r.items.map((i) => ({
        id: i.id,
        title: i.title,
        helpText: i.helpText,
        required: i.required,
        allowedTypes: i.allowedTypes,
        status: i.status,
        rejectReason: i.rejectReason,
        files: i.files.map((f) => ({
          id: f.id,
          size: f.size,
          mimeType: f.mimeType,
          uploadedAt: f.createdAt.toISOString(),
          state: f.processedAt ? 'READY' : 'CHECKING',
        })),
      })),
    };
  }
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}

export function maskEmail(email: string): string {
  const [user = '', domain = ''] = email.split('@');
  return `${user.slice(0, 1)}•••@${domain}`;
}
