import { Controller, Get } from '@nestjs/common';
import { NoticeService } from './notice.service';

// 공개 — 인증 없음. 메인 화면 팝업이 게시된 최신 공지를 읽는다.
@Controller('notice')
export class NoticeController {
  constructor(private readonly notice: NoticeService) {}

  @Get()
  async active() {
    // { notice: Notice | null } 래핑 — getMe 등 다른 공개 응답과 형태를 맞춘다.
    return { notice: await this.notice.getActive() };
  }
}
