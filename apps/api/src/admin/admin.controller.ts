import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { CleanupDto } from './dto/cleanup.dto';
import { AdminUpdateDeadlineDto } from './dto/update-deadline.dto';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  stats() {
    return this.admin.getStats();
  }

  @Get('rooms')
  list(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('order') order?: 'recent' | 'participants',
    @Query('q') q?: string,
  ) {
    return this.admin.listRooms({
      limit: limit != null ? Number(limit) : undefined,
      offset: offset != null ? Number(offset) : undefined,
      order,
      q,
    });
  }

  // 전체 방 CSV (목록 라우트보다 위에 둬야 :roomId 와 충돌 안 함)
  @Get('rooms.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportRoomsCsv(@Res({ passthrough: true }) res: Response) {
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="whenever-rooms-${dateStamp()}.csv"`,
    );
    return this.admin.exportRoomsCsv();
  }

  @Get('rooms/:roomId')
  detail(@Param('roomId') roomId: string) {
    return this.admin.getRoomDetail(roomId);
  }

  @Get('rooms/:roomId/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportRoomCsv(
    @Param('roomId') roomId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="whenever-${roomId}.csv"`,
    );
    return this.admin.exportRoomCsv(roomId);
  }

  @Delete('rooms/:roomId')
  remove(@Param('roomId') roomId: string) {
    return this.admin.deleteRoom(roomId);
  }

  @Patch('rooms/:roomId/deadline')
  updateDeadline(
    @Param('roomId') roomId: string,
    @Body() dto: AdminUpdateDeadlineDto,
  ) {
    return this.admin.updateRoomDeadline(roomId, dto.deadline ?? null);
  }

  @Delete('rooms/:roomId/participants/:participantId')
  kick(
    @Param('roomId') roomId: string,
    @Param('participantId', ParseIntPipe) participantId: number,
  ) {
    return this.admin.kickParticipant(roomId, participantId);
  }

  @Get('logs')
  logs(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.admin.listActions({
      limit: limit != null ? Number(limit) : undefined,
      offset: offset != null ? Number(offset) : undefined,
    });
  }

  @Post('cleanup')
  cleanup(@Body() body: CleanupDto) {
    return this.admin.cleanupOldRooms(body.days ?? 90);
  }
}

function dateStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}
