import { Body, Controller, Get, Headers, Param, Patch, Post } from '@nestjs/common';
import { HEADER_CREATOR_TOKEN } from '@whenever/shared';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateDeadlineDto } from './dto/update-deadline.dto';
import { RoomsService } from './rooms.service';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Post()
  create(@Body() dto: CreateRoomDto) {
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
}
