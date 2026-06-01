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
} from '@nestjs/common';
import { HEADER_CLIENT_TOKEN, HEADER_CREATOR_TOKEN } from '@whenever/shared';
import { JoinRoomDto, RecoverParticipantDto } from './dto/join-room.dto';
import { UpdateAvailabilitiesDto } from './dto/update-availabilities.dto';
import { ParticipantsService } from './participants.service';

@Controller('rooms/:roomId/participants')
export class ParticipantsController {
  constructor(private readonly participants: ParticipantsService) {}

  @Post()
  join(@Param('roomId') roomId: string, @Body() dto: JoinRoomDto) {
    return this.participants.join(roomId, dto.nickname, dto.pin);
  }

  @Post('recover')
  recover(
    @Param('roomId') roomId: string,
    @Body() dto: RecoverParticipantDto,
  ) {
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
    @Param('roomId') roomId: string,
    @Headers(HEADER_CLIENT_TOKEN) clientToken: string | undefined,
    @Body() dto: UpdateAvailabilitiesDto,
  ) {
    return this.participants.updateAvailabilities(roomId, clientToken, dto.dateIds);
  }

  @Delete(':participantId')
  remove(
    @Param('roomId') roomId: string,
    @Param('participantId', ParseIntPipe) participantId: number,
    @Headers(HEADER_CREATOR_TOKEN) creatorToken: string | undefined,
  ) {
    return this.participants.removeByCreator(roomId, creatorToken, participantId);
  }
}
