import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { clientIp } from '../common/client-ip';
import { RateLimitService } from '../common/rate-limit.service';
import { AnalyticsService } from './analytics.service';
import { TrackDto } from './dto/track.dto';

// 공개 방문 비콘 — 프론트가 페이지 로드 시 1회 호출. 인증 없음, PII 없음.
@Controller('track')
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly rl: RateLimitService,
  ) {}

  @Post()
  async track(@Req() req: Request, @Body() dto: TrackDto) {
    // IP당 1분 120회 — 정상 브라우징 한도 넉넉히, 카운트 뻥튀기 스팸만 억제.
    this.rl.check(`track:${clientIp(req)}`, 120, 60);
    await this.analytics.recordVisit(dto.path, dto.referrer, dto.ref);
    return { ok: true };
  }
}
