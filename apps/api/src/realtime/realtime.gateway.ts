import { Injectable, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:3000';

@Injectable()
@WebSocketGateway({
  cors: { origin: corsOrigin.split(',').map((s) => s.trim()), credentials: true },
})
export class RealtimeGateway implements OnGatewayInit {
  @WebSocketServer()
  server!: Server;

  private readonly log = new Logger(RealtimeGateway.name);

  afterInit() {
    this.log.log('socket.io ready');
  }

  @SubscribeMessage('room:join')
  joinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId?: unknown },
  ): { ok: boolean; room?: string } {
    const roomId = typeof data?.roomId === 'string' ? data.roomId : '';
    if (!roomId) return { ok: false };
    client.join(`room:${roomId}`);
    return { ok: true, room: roomId };
  }

  @SubscribeMessage('room:leave')
  leaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId?: unknown },
  ): { ok: boolean } {
    const roomId = typeof data?.roomId === 'string' ? data.roomId : '';
    if (!roomId) return { ok: false };
    client.leave(`room:${roomId}`);
    return { ok: true };
  }

  emitResultsUpdated(roomId: string) {
    this.server.to(`room:${roomId}`).emit('room:results_updated', { roomId });
  }

  emitDeadlineUpdated(roomId: string, deadline: string | null) {
    this.server
      .to(`room:${roomId}`)
      .emit('room:deadline_updated', { roomId, deadline });
  }

  emitRoomDeleted(roomId: string) {
    this.server.to(`room:${roomId}`).emit('room:deleted', { roomId });
  }
}
