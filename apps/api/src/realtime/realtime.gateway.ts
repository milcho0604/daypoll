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

// CORS_ORIGIN을 연결 시점에 lazy 평가한다.
// (모듈 import 시점엔 ConfigModule의 .env 로딩이 아직 안 끝나 process.env가 비어있을 수 있다)
function allowedOrigins(): string[] {
  return (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

@Injectable()
@WebSocketGateway({
  cors: {
    credentials: true,
    origin: (
      origin: string | undefined,
      cb: (err: Error | null, allow?: boolean) => void,
    ) => {
      const allowed = allowedOrigins();
      // origin 없는 요청(서버-서버, 헬스체크 등)은 허용
      if (!origin || allowed.includes(origin)) cb(null, true);
      else cb(new Error('Not allowed by CORS'), false);
    },
  },
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
    void client.join(`room:${roomId}`);
    return { ok: true, room: roomId };
  }

  @SubscribeMessage('room:leave')
  leaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId?: unknown },
  ): { ok: boolean } {
    const roomId = typeof data?.roomId === 'string' ? data.roomId : '';
    if (!roomId) return { ok: false };
    void client.leave(`room:${roomId}`);
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
