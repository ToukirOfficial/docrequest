import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import {
  forgotPasswordSchema,
  loginSchema,
  loginVerifySchema,
  resetPasswordSchema,
  signupSchema,
  type ForgotPasswordInput,
  type LoginChallengeResponse,
  type LoginInput,
  type LoginVerifyInput,
  type MeResponse,
  type ResetPasswordInput,
  type SignupInput,
} from '@docrequest/shared';
import { CurrentUser, Public, type AppRequest, type AuthUser } from '../common/decorators.js';
import { RateLimit } from '../common/rate-limit.js';
import { LOGIN_COOKIE, REFRESH_COOKIE, readCookie } from '../common/cookies.js';
import { AuthService } from './auth.service.js';
import { TokensService } from './tokens.service.js';

const FIFTEEN_MIN = 15 * 60;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokensService,
  ) {}

  @Public()
  @Post('signup')
  @HttpCode(201)
  @RateLimit({ name: 'signup', limit: 5, windowSec: 60 * 60, by: ['ip'] })
  async signup(
    @Body({ schema: signupSchema }) body: SignupInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginChallengeResponse> {
    await this.auth.signup(body, res);
    return { codeSent: true };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @RateLimit({ name: 'login', limit: 10, windowSec: FIFTEEN_MIN, by: ['ip', 'email'] })
  async login(
    @Body({ schema: loginSchema }) body: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginChallengeResponse> {
    await this.auth.login(body, res);
    return { codeSent: true };
  }

  @Public()
  @Post('login/verify')
  @HttpCode(204)
  @RateLimit({ name: 'login-code', limit: 10, windowSec: FIFTEEN_MIN, by: ['ip'] })
  async verify(
    @Body({ schema: loginVerifySchema }) body: LoginVerifyInput,
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.verifyLogin(readCookie(req, LOGIN_COOKIE), body.code, res);
  }

  @Public()
  @Post('refresh')
  @HttpCode(204)
  @RateLimit({ name: 'refresh', limit: 60, windowSec: FIFTEEN_MIN, by: ['ip'] })
  async refresh(@Req() req: AppRequest, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.tokens.rotate(res, readCookie(req, REFRESH_COOKIE));
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: AppRequest, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(readCookie(req, REFRESH_COOKIE), res);
  }

  @Public()
  @Post('password/forgot')
  @HttpCode(204)
  @RateLimit({ name: 'pw-forgot', limit: 5, windowSec: 60 * 60, by: ['ip', 'email'] })
  async forgot(@Body({ schema: forgotPasswordSchema }) body: ForgotPasswordInput): Promise<void> {
    await this.auth.forgotPassword(body);
  }

  @Public()
  @Post('password/reset')
  @HttpCode(204)
  @RateLimit({ name: 'pw-reset', limit: 10, windowSec: 60 * 60, by: ['ip'] })
  async reset(@Body({ schema: resetPasswordSchema }) body: ResetPasswordInput): Promise<void> {
    await this.auth.resetPassword(body);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<MeResponse> {
    return this.auth.me(user.id);
  }
}
