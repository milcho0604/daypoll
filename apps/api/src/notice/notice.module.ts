import { Module } from '@nestjs/common';
import { NoticeController } from './notice.controller';
import { NoticeService } from './notice.service';

// 공개 GET /notice 는 이 모듈이, 어드민 쓰기는 AdminController 가
// NoticeService 를 주입받아 처리한다 → exports 로 공유.
@Module({
  controllers: [NoticeController],
  providers: [NoticeService],
  exports: [NoticeService],
})
export class NoticeModule {}
