import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { clientIp } from '../common/client-ip';
import { RateLimitService } from '../common/rate-limit.service';
import { ADMIN_TOKEN_MIN_LENGTH, secureEquals } from '../common/secure-compare';

export const ADMIN_TOKEN_HEADER = 'x-admin-token';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly rl: RateLimitService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.config.get<string>('ADMIN_TOKEN');
    if (!required || required.length < ADMIN_TOKEN_MIN_LENGTH) {
      // 환경변수 없으면 어드민 비활성화 (오픈 노출 방지)
      throw new ServiceUnavailableException('admin disabled');
    }
    const req = ctx.switchToHttp().getRequest<Request>();
    const headerVal = req.header(ADMIN_TOKEN_HEADER) as
      | string
      | string[]
      | undefined;
    const token = Array.isArray(headerVal) ? headerVal[0] : headerVal;
    if (!secureEquals(token, required)) {
      // 틀린 토큰만 센다 — IP 당 10분 10회 넘으면 429 (정상 어드민 사용은 영향 없음)
      this.rl.check(`admin:fail:${clientIp(req)}`, 10, 600);
      throw new UnauthorizedException();
    }
    return true;
  }
}
