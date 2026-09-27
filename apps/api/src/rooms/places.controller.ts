import {
  Body,
  Controller,
  Delete,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { HEADER_CLIENT_TOKEN, HEADER_CREATOR_TOKEN } from '@whenever/shared';
import { clientIp } from '../common/client-ip';
import { RateLimitService } from '../common/rate-limit.service';
import { AddPlaceDto, ConfirmPlaceDto } from './dto/place.dto';
import { PlacesService } from './places.service';

// 장소·메뉴 투표. 확정은 날짜 확정(POST/DELETE /rooms/:id/confirm)과 짝을 맞춰
// /rooms/:id/place-confirm 로 둔다 — /places/:placeId 와 경로가 겹치지 않게.
@Controller('rooms/:roomId')
export class PlacesController {
  constructor(
    private readonly places: PlacesService,
    private readonly rl: RateLimitService,
  ) {}

  @Post('places')
  add(
    @Req() req: Request,
    @Param('roomId') roomId: string,
    @Headers(HEADER_CLIENT_TOKEN) clientToken: string | undefined,
    @Body() dto: AddPlaceDto,
  ) {
    // 후보 도배 방지: IP당 1분에 20개 (방당 상한 20개는 서비스가 따로 막는다).
    this.rl.check(`place:add:${clientIp(req)}`, 20, 60);
    return this.places.add(roomId, clientToken, dto);
  }

  @Patch('places/:placeId')
  update(
    @Req() req: Request,
    @Param('roomId') roomId: string,
    @Param('placeId', ParseIntPipe) placeId: number,
    @Headers(HEADER_CLIENT_TOKEN) clientToken: string | undefined,
    @Headers(HEADER_CREATOR_TOKEN) creatorToken: string | undefined,
    @Body() dto: AddPlaceDto,
  ) {
    this.rl.check(`place:add:${clientIp(req)}`, 20, 60);
    return this.places.update(roomId, placeId, clientToken, creatorToken, dto);
  }

  @Delete('places/:placeId')
  remove(
    @Req() req: Request,
    @Param('roomId') roomId: string,
    @Param('placeId', ParseIntPipe) placeId: number,
    @Headers(HEADER_CLIENT_TOKEN) clientToken: string | undefined,
    @Headers(HEADER_CREATOR_TOKEN) creatorToken: string | undefined,
  ) {
    this.rl.check(`place:add:${clientIp(req)}`, 20, 60);
    return this.places.remove(roomId, placeId, clientToken, creatorToken);
  }

  // 날짜 투표(vote:ip 60/분)와 한도를 나누지 않는다 — 같은 와이파이의 친구들이
  // 날짜·장소를 함께 누르면 한 버킷으로는 금방 찬다.
  @Put('places/:placeId/vote')
  vote(
    @Req() req: Request,
    @Param('roomId') roomId: string,
    @Param('placeId', ParseIntPipe) placeId: number,
    @Headers(HEADER_CLIENT_TOKEN) clientToken: string | undefined,
  ) {
    this.rl.check(`place:vote:${clientIp(req)}`, 120, 60);
    return this.places.setVote(roomId, placeId, clientToken, true);
  }

  @Delete('places/:placeId/vote')
  unvote(
    @Req() req: Request,
    @Param('roomId') roomId: string,
    @Param('placeId', ParseIntPipe) placeId: number,
    @Headers(HEADER_CLIENT_TOKEN) clientToken: string | undefined,
  ) {
    this.rl.check(`place:vote:${clientIp(req)}`, 120, 60);
    return this.places.setVote(roomId, placeId, clientToken, false);
  }

  @Post('place-confirm')
  confirm(
    @Param('roomId') roomId: string,
    @Headers(HEADER_CREATOR_TOKEN) creatorToken: string | undefined,
    @Body() dto: ConfirmPlaceDto,
  ) {
    return this.places.confirm(roomId, creatorToken, dto.placeId);
  }

  @Delete('place-confirm')
  unconfirm(
    @Param('roomId') roomId: string,
    @Headers(HEADER_CREATOR_TOKEN) creatorToken: string | undefined,
  ) {
    return this.places.unconfirm(roomId, creatorToken);
  }
}
