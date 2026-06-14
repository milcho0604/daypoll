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
import { secureEquals } from '../common/secure-compare';

// nanoid 형식 (영숫자 + `_` `-`, 8~16자). 임의 문자열로 enumeration 시도 차단.
const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]{8,16}$/;

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
    if (!ROOM_ID_PATTERN.test(roomId)) return { ok: false };
    void client.join(`room:${roomId}`);
    return { ok: true, room: roomId };
  }

  @SubscribeMessage('room:leave')
  leaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId?: unknown },
  ): { ok: boolean } {
    const roomId = typeof data?.roomId === 'string' ? data.roomId : '';
    if (!ROOM_ID_PATTERN.test(roomId)) return { ok: false };
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

  // 어드민 페이지가 구독하는 채널. 이벤트마다 type 을 분리한다.
  // 인증은 단순 token-by-event 로 단순화 — 클라이언트가 'admin:auth' 로
  // 토큰을 보내면 그 소켓만 admin 룸에 합류시킨다.
  @SubscribeMessage('admin:auth')
  adminAuth(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { token?: unknown },
  ): { ok: boolean } {
    const expected = process.env.ADMIN_TOKEN ?? '';
    const got = typeof data?.token === 'string' ? data.token : '';
    if (expected.length >= 8 && secureEquals(got, expected)) {
      void client.join('admin');
      return { ok: true };
    }
    return { ok: false };
  }

  emitAdminEvent(type: string, payload: Record<string, unknown>) {
    this.server
      .to('admin')
      .emit('admin:event', { type, ts: new Date().toISOString(), ...payload });
  }
}
