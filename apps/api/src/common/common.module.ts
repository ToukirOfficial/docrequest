import { Global, Module } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from './prisma.service.js';
import { RedisService } from './redis.service.js';

@Global()
@Module({
  providers: [PrismaService, RedisService, AuditService, MailService],
  exports: [PrismaService, RedisService, AuditService, MailService],
})
export class CommonModule {}
