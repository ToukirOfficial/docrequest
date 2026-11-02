import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { env } from './config/env.js';
import { CommonModule } from './common/common.module.js';
import { RateLimitGuard } from './common/rate-limit.js';
import { AuthGuard } from './common/auth.guard.js';
import { AuthModule } from './auth/auth.module.js';
import { WorkspacesModule } from './workspaces/workspaces.module.js';
import { RequestsModule } from './requests/requests.module.js';
import { ClientModule } from './client/client.module.js';
import { ReviewModule } from './review/review.module.js';
import { DemoModule } from './demo/demo.module.js';
import { HealthController } from './health.controller.js';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: env.JWT_SECRET,
      signOptions: { algorithm: 'HS256' },
    }),
    CommonModule,
    AuthModule,
    WorkspacesModule,
    RequestsModule,
    ClientModule,
    ReviewModule,
    DemoModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: auth first (so per-user limits can see the user), then limits.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
  ],
})
export class AppModule {}
