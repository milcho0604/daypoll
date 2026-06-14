import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';
import type { JoinRoomResponse } from '@whenever/shared';
import { PG_POOL } from '../database/database.module';
import { withTransaction } from '../common/db.helpers';
import { newToken } from '../common/ids';
import { hashPin, verifyPin } from '../common/pin';
import { secureEquals } from '../common/secure-compare';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class ParticipantsService {
  // PIN 닉네임당 lockout — IP-기반 rate limit 위에 닉네임 차원 추가 가드.
  // 공격자가 IP 회전으로 IP rate limit 을 피해도 같은 (방, 닉네임) 조합은
  // 5회 실패 시 30분 잠금. in-memory 라 재시작 시 리셋.
  private readonly pinFailures = new Map<
    string,
    { count: number; until: number }
  >();
  private static readonly PIN_MAX_ATTEMPTS = 5;
  private static readonly PIN_LOCKOUT_MS = 30 * 60 * 1000;

  private pinKey(roomId: string, nickname: string): string {
    return `${roomId}::${nickname.trim().toLowerCase()}`;
  }

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly realtime: RealtimeGateway,
  ) {}

  async join(
    roomId: string,
    nickname: string,
    pin?: string,
  ): Promise<JoinRoomResponse> {
    const roomRes = await this.pool.query('SELECT 1 FROM rooms WHERE id = $1', [
      roomId,
    ]);
    if (roomRes.rowCount === 0) {
      throw new NotFoundException('room not found');
    }
    const base = nickname.trim();
    // 같은 방에 같은 닉네임이 이미 있으면 "지원 (2)" 식으로 자동 차별화.
    // 친구 모임에서 "지수" "지수" 같이 흔한 충돌 방지 — 강퇴 사고도 막음.
    const dup = await this.pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM participants
       WHERE room_id = $1 AND (nickname = $2 OR nickname LIKE $2 || ' (%)')`,
      [roomId, base],
    );
    const conflicts = Number(dup.rows[0].c);
    const finalNickname = conflicts === 0 ? base : `${base} (${conflicts + 1})`;

    const clientToken = newToken();
    const pinHash = pin ? hashPin(pin) : null;
    const res = await this.pool.query<{ id: string; nickname: string }>(
      `INSERT INTO participants (room_id, nickname, client_token, pin_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id::text, nickname`,
      [roomId, finalNickname, clientToken, pinHash],
    );
    this.realtime.emitResultsUpdated(roomId); // 참여자 수 변경
    this.realtime.emitAdminEvent('participant_joined', {
      roomId,
      nickname: res.rows[0].nickname,
    });
    return {
      participantId: Number(res.rows[0].id),
      clientToken,
      nickname: res.rows[0].nickname,
    };
  }

  async recover(
    roomId: string,
    pin: string,
    nickname?: string,
  ): Promise<JoinRoomResponse> {
    // lockout 키: 닉네임 있으면 (방, 닉네임), 없으면 (방) 전체.
    // PIN-only 모드에서는 방 단위로만 묶어서 brute 차단.
    const key = nickname ? this.pinKey(roomId, nickname) : `${roomId}::__any__`;
    const entry = this.pinFailures.get(key);
    const now = Date.now();
    if (entry && entry.until > now) {
      throw new HttpException(
        'too many failed attempts — try again later',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (entry && entry.until <= now) {
      this.pinFailures.delete(key);
    }

    // 닉네임 있으면 그것만, 없으면 방 전체 PIN 후보 검색
    const candidates = nickname
      ? await this.pool.query<{
          id: string;
          nickname: string;
          pin_hash: string | null;
        }>(
          `SELECT id::text, nickname, pin_hash FROM participants
           WHERE room_id = $1 AND nickname = $2 AND pin_hash IS NOT NULL
           ORDER BY created_at ASC`,
          [roomId, nickname.trim()],
        )
      : await this.pool.query<{
          id: string;
          nickname: string;
          pin_hash: string | null;
        }>(
          `SELECT id::text, nickname, pin_hash FROM participants
           WHERE room_id = $1 AND pin_hash IS NOT NULL
           ORDER BY created_at ASC`,
          [roomId],
        );

    const matches = candidates.rows.filter((row) =>
      verifyPin(pin, row.pin_hash),
    );

    if (matches.length === 1) {
      const row = matches[0];
      const newCt = newToken();
      await this.pool.query(
        `UPDATE participants SET client_token = $1 WHERE id = $2`,
        [newCt, row.id],
      );
      this.pinFailures.delete(key);
      return {
        participantId: Number(row.id),
        clientToken: newCt,
        nickname: row.nickname,
      };
    }

    if (matches.length > 1 && !nickname) {
      // 같은 방에 같은 PIN 가입자 여러 명 — 모호. 닉네임으로 다시 시도하라고 클라이언트에 알림.
      throw new HttpException(
        'multiple matches — provide nickname',
        HttpStatus.CONFLICT,
      );
    }

    // 0 매칭 → 실패 카운트 증가
    const next = (entry?.count ?? 0) + 1;
    if (next >= ParticipantsService.PIN_MAX_ATTEMPTS) {
      this.pinFailures.set(key, {
        count: next,
        until: now + ParticipantsService.PIN_LOCKOUT_MS,
      });
    } else {
      this.pinFailures.set(key, { count: next, until: 0 });
    }
    throw new ForbiddenException('pin does not match');
  }

  async updateAvailabilities(
    roomId: string,
    clientToken: string | undefined,
    dateIds: number[],
  ): Promise<{ dateIds: number[] }> {
    if (!clientToken) {
      throw new ForbiddenException('client token required');
    }

    // 마감 가드 — 기획서 8장 423 Locked
    const roomRes = await this.pool.query<{ deadline: Date | null }>(
      `SELECT deadline FROM rooms WHERE id = $1`,
      [roomId],
    );
    if (roomRes.rowCount === 0) {
      throw new NotFoundException('room not found');
    }
    const deadline = roomRes.rows[0].deadline;
    if (deadline && deadline.getTime() <= Date.now()) {
      throw new HttpException('room is locked', HttpStatus.LOCKED);
    }

    // 본인 검증
    const me = await this.pool.query<{ id: string }>(
      `SELECT id::text FROM participants WHERE room_id = $1 AND client_token = $2`,
      [roomId, clientToken],
    );
    if (me.rowCount === 0) {
      throw new ForbiddenException('not a participant');
    }
    const participantId = Number(me.rows[0].id);

    // 후보 날짜만 인정 (다른 방의 dateId, 임의 id 차단)
    const allowed = await this.pool.query<{ id: string }>(
      `SELECT id::text FROM room_dates WHERE room_id = $1`,
      [roomId],
    );
    const allowedSet = new Set(allowed.rows.map((r) => Number(r.id)));
    const filtered = Array.from(new Set(dateIds)).filter((id) =>
      allowedSet.has(id),
    );

    await withTransaction(this.pool, async (c) => {
      await c.query(`DELETE FROM availabilities WHERE participant_id = $1`, [
        participantId,
      ]);
      for (const id of filtered) {
        await c.query(
          `INSERT INTO availabilities (participant_id, room_date_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [participantId, id],
        );
      }
    });

    this.realtime.emitResultsUpdated(roomId);
    return { dateIds: filtered };
  }

  async removeByCreator(
    roomId: string,
    creatorToken: string | undefined,
    participantId: number,
  ): Promise<{ deleted: boolean }> {
    if (!creatorToken) {
      throw new ForbiddenException('creator token required');
    }
    const roomRes = await this.pool.query<{ creator_token: string | null }>(
      `SELECT creator_token FROM rooms WHERE id = $1`,
      [roomId],
    );
    if (roomRes.rowCount === 0) throw new NotFoundException('room not found');
    if (!secureEquals(roomRes.rows[0].creator_token, creatorToken)) {
      throw new ForbiddenException('not the creator');
    }
    const del = await this.pool.query(
      `DELETE FROM participants WHERE id = $1 AND room_id = $2`,
      [participantId, roomId],
    );
    if (del.rowCount === 0)
      throw new NotFoundException('participant not found');
    this.realtime.emitResultsUpdated(roomId);
    return { deleted: true };
  }

  async getMine(roomId: string, clientToken: string | undefined) {
    if (!clientToken) {
      return null;
    }
    const me = await this.pool.query<{ id: string; nickname: string }>(
      `SELECT id::text, nickname FROM participants
       WHERE room_id = $1 AND client_token = $2`,
      [roomId, clientToken],
    );
    if (me.rowCount === 0) {
      return null;
    }
    const av = await this.pool.query<{ room_date_id: string }>(
      `SELECT room_date_id::text FROM availabilities WHERE participant_id = $1`,
      [me.rows[0].id],
    );
    return {
      participantId: Number(me.rows[0].id),
      nickname: me.rows[0].nickname,
      dateIds: av.rows.map((r) => Number(r.room_date_id)),
    };
  }
}
