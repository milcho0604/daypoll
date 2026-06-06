import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { HEADER_CREATOR_TOKEN } from '@whenever/shared';
import { clientIp } from '../common/client-ip';
import { RateLimitService } from '../common/rate-limit.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateDeadlineDto } from './dto/update-deadline.dto';
import { RoomsService } from './rooms.service';

@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly rooms: RoomsService,
    private readonly rl: RateLimitService,
  ) {}

  @Post()
  create(@Req() req: Request, @Body() dto: CreateRoomDto) {
    // 방 생성 남용 방지: IP당 1분에 20개.
    this.rl.check(`room:create:${clientIp(req)}`, 20, 60);
    return this.rooms.create(dto);
  }

  @Get(':roomId')
  detail(@Param('roomId') roomId: string) {
    return this.rooms.getDetail(roomId);
  }

  @Get(':roomId/results')
  results(@Param('roomId') roomId: string) {
    return this.rooms.getResults(roomId);
  }

  @Patch(':roomId/deadline')
  updateDeadline(
    @Param('roomId') roomId: string,
    @Headers(HEADER_CREATOR_TOKEN) creatorToken: string | undefined,
    @Body() dto: UpdateDeadlineDto,
  ) {
    return this.rooms.updateDeadline(roomId, creatorToken, dto.deadline);
  }

  @Get(':roomId/winner.ics')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  async winnerIcs(
    @Param('roomId') roomId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const ics = await this.rooms.buildWinnerIcs(roomId);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="whenever-${roomId}.ics"`,
    );
    return ics;
  }
}
