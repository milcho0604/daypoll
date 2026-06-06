import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { HEADER_CLIENT_TOKEN, HEADER_CREATOR_TOKEN } from '@whenever/shared';
import { clientIp } from '../common/client-ip';
import { RateLimitService } from '../common/rate-limit.service';
import { JoinRoomDto, RecoverParticipantDto } from './dto/join-room.dto';
import { UpdateAvailabilitiesDto } from './dto/update-availabilities.dto';
import { ParticipantsService } from './participants.service';

@Controller('rooms/:roomId/participants')
export class ParticipantsController {
  constructor(
    private readonly participants: ParticipantsService,
    private readonly rl: RateLimitService,
  ) {}

  @Post()
  join(
    @Req() req: Request,
    @Param('roomId') roomId: string,
    @Body() dto: JoinRoomDto,
  ) {
    // 입장(참여자 생성) 남용 방지: IP당 1분에 30회.
    this.rl.check(`participant:join:${clientIp(req)}`, 30, 60);
    return this.participants.join(roomId, dto.nickname, dto.pin);
  }

  @Post('recover')
  recover(
    @Req() req: Request,
    @Param('roomId') roomId: string,
    @Body() dto: RecoverParticipantDto,
  ) {
    // PIN 브루트포스 방지: 같은 IP+방 기준 10분당 10회.
    this.rl.check(`recover:${clientIp(req)}:${roomId}`, 10, 600);
    return this.participants.recover(roomId, dto.nickname, dto.pin);
  }

  @Get('me')
  async me(
    @Param('roomId') roomId: string,
    @Headers(HEADER_CLIENT_TOKEN) clientToken: string | undefined,
  ) {
    const me = await this.participants.getMine(roomId, clientToken);
    return { me };
  }

  @Put('me/availabilities')
  updateAvailabilities(
    @Req() req: Request,
    @Param('roomId') roomId: string,
    @Headers(HEADER_CLIENT_TOKEN) clientToken: string | undefined,
    @Body() dto: UpdateAvailabilitiesDto,
  ) {
    // 투표 갱신 남용 방지: IP당 1분에 60회.
    this.rl.check(`vote:${clientIp(req)}`, 60, 60);
    return this.participants.updateAvailabilities(
      roomId,
      clientToken,
      dto.dateIds,
    );
  }

  @Delete(':participantId')
  remove(
    @Param('roomId') roomId: string,
    @Param('participantId', ParseIntPipe) participantId: number,
    @Headers(HEADER_CREATOR_TOKEN) creatorToken: string | undefined,
  ) {
    return this.participants.removeByCreator(
      roomId,
      creatorToken,
      participantId,
    );
  }
}
