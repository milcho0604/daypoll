import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { secureEquals } from '../common/secure-compare';

export const ADMIN_TOKEN_HEADER = 'x-admin-token';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.config.get<string>('ADMIN_TOKEN');
    if (!required || required.length < 8) {
      // 환경변수 없으면 어드민 비활성화 (오픈 노출 방지)
      throw new ServiceUnavailableException('admin disabled');
    }
    const req = ctx.switchToHttp().getRequest<Request>();
    const headerVal = req.header(ADMIN_TOKEN_HEADER);
    const token = Array.isArray(headerVal) ? headerVal[0] : headerVal;
    if (!secureEquals(token, required)) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
