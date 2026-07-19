import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';
import { NoticeModule } from '../notice/notice.module';

@Module({
  // NoticeModule 을 import 해 NoticeService 를 AdminController 에 주입 (공지 쓰기).
  imports: [NoticeModule],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard],
  exports: [AdminService],
})
export class AdminModule {}
