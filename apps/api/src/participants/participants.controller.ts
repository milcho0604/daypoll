import { Body, Controller, Get, Headers, Param, Post, Put } from '@nestjs/common';
import { HEADER_CLIENT_TOKEN } from '@whenever/shared';
import { JoinRoomDto } from './dto/join-room.dto';
import { UpdateAvailabilitiesDto } from './dto/update-availabilities.dto';
import { ParticipantsService } from './participants.service';

@Controller('rooms/:roomId/participants')
export class ParticipantsController {
  constructor(private readonly participants: ParticipantsService) {}

  @Post()
  join(@Param('roomId') roomId: string, @Body() dto: JoinRoomDto) {
    return this.participants.join(roomId, dto.nickname);
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
    @Param('roomId') roomId: string,
    @Headers(HEADER_CLIENT_TOKEN) clientToken: string | undefined,
    @Body() dto: UpdateAvailabilitiesDto,
  ) {
    return this.participants.updateAvailabilities(roomId, clientToken, dto.dateIds);
  }
}
