import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

// 공개 POST /track 은 이 모듈이, 어드민 조회는 AdminController 가
// AnalyticsService 를 주입받아 처리 → exports 로 공유.
// (RateLimitService 는 CommonModule 이 @Global 이라 자동 주입됨)
@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
