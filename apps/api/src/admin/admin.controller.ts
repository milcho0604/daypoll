import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

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

  @Get('rooms/:roomId')
  detail(@Param('roomId') roomId: string) {
    return this.admin.getRoomDetail(roomId);
  }

  @Delete('rooms/:roomId')
  remove(@Param('roomId') roomId: string) {
    return this.admin.deleteRoom(roomId);
  }

  @Post('cleanup')
  cleanup(@Body() body: { days?: number }) {
    return this.admin.cleanupOldRooms(body?.days ?? 90);
  }
}
