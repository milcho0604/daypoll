import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';
import { NoticeModule } from '../notice/notice.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  // NoticeService(공지 쓰기)·AnalyticsService(방문 집계 조회)를 AdminController 에 주입.
  imports: [NoticeModule, AnalyticsModule],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard],
  exports: [AdminService],
})
export class AdminModule {}
