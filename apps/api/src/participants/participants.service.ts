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
    { count: number; until: number; ts: number }
  >();
  private static readonly PIN_MAX_ATTEMPTS = 5;
  private static readonly PIN_LOCKOUT_MS = 30 * 60 * 1000;
  private lastPinSweep = Date.now();

  private pinKey(roomId: string, nickname: string): string {
    return `${roomId}::${nickname.trim().toLowerCase()}`;
  }

  // 마지막 갱신 후 lockout 기간(30분) 지난 엔트리를 가끔 청소.
  // 다시 접근 안 되는 (방,닉네임) 조합이 영구 누적되는 메모리 누수를 막는다.
  private sweepPinFailures(now: number): void {
    if (now - this.lastPinSweep < 60_000) return;
    this.lastPinSweep = now;
    for (const [k, v] of this.pinFailures) {
      if (now - v.ts > ParticipantsService.PIN_LOCKOUT_MS) {
        this.pinFailures.delete(k);
      }
    }
  }

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly realtime: RealtimeGateway,
  ) {}

  async join(
    roomId: string,
    nickname: string,
    pin?: string,
    creatorToken?: string,
  ): Promise<JoinRoomResponse> {
    const roomRes = await this.pool.query<{ creator_token: string | null }>(
      'SELECT creator_token FROM rooms WHERE id = $1',
      [roomId],
    );
    if (roomRes.rowCount === 0) {
      throw new NotFoundException('room not found');
    }
    const base = nickname.trim();
    const clientToken = newToken();
    const pinHash = pin ? await hashPin(pin) : null;

    // 같은 방에 같은 닉네임이 이미 있으면 "지수 (2)" 식으로 자동 차별화.
    // 카운트→insert 사이 경쟁(TOCTOU)으로 같은 닉네임이 동시 생성되지 않도록
    // (방, 닉네임) 단위 advisory lock 으로 동시 입장을 직렬화한다.
    const { finalNickname, participantId } = await withTransaction(
      this.pool,
      async (c) => {
        await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          `nick:${roomId}:${base.toLowerCase()}`,
        ]);
        const dup = await c.query<{ c: string }>(
          `SELECT COUNT(*)::text AS c FROM participants
           WHERE room_id = $1 AND (nickname = $2 OR nickname LIKE $2 || ' (%)')`,
          [roomId, base],
        );
        const conflicts = Number(dup.rows[0].c);
        const fn = conflicts === 0 ? base : `${base} (${conflicts + 1})`;
        const res = await c.query<{ id: string; nickname: string }>(
          `INSERT INTO participants (room_id, nickname, client_token, pin_hash)
           VALUES ($1, $2, $3, $4)
           RETURNING id::text, nickname`,
          [roomId, fn, clientToken, pinHash],
        );
        return {
          finalNickname: res.rows[0].nickname,
          participantId: Number(res.rows[0].id),
        };
      },
    );

    // 방 만든 사람의 첫 입장 — creator_token 매칭되면 이 participant 를 방 주인으로 link.
    // 그 후 같은 PIN 으로 다른 기기 복원 시 creator_token 자동 회수 가능.
    let returnedCreatorToken: string | undefined;
    if (
      creatorToken &&
      roomRes.rows[0].creator_token &&
      secureEquals(creatorToken, roomRes.rows[0].creator_token)
    ) {
      await this.pool.query(
        `UPDATE rooms SET creator_participant_id = $1
         WHERE id = $2 AND creator_participant_id IS NULL`,
        [participantId, roomId],
      );
      returnedCreatorToken = roomRes.rows[0].creator_token;
    }

    this.realtime.emitResultsUpdated(roomId); // 참여자 수 변경
    this.realtime.emitAdminEvent('participant_joined', {
      roomId,
      nickname: finalNickname,
    });
    return {
      participantId,
      clientToken,
      nickname: finalNickname,
      creatorToken: returnedCreatorToken,
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
    const now = Date.now();
    this.sweepPinFailures(now);
    const entry = this.pinFailures.get(key);
    if (entry && entry.until > now) {
      throw new HttpException(
        'too many failed attempts — try again later',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (entry && entry.until <= now) {
      this.pinFailures.delete(key);
    }

    // 닉네임 있으면 그것만, 없으면 방 전체 PIN 후보 검색.
    // client_token 도 같이 SELECT — recover 는 새 토큰을 발급하지 않고 기존 토큰을 그대로 반환.
    // 이렇게 해야 한 사람 = 한 토큰 → 폰/PC 동시에 같은 본인 인식 (multi-device).
    const candidates = nickname
      ? await this.pool.query<{
          id: string;
          nickname: string;
          client_token: string;
          pin_hash: string | null;
        }>(
          `SELECT id::text, nickname, client_token, pin_hash FROM participants
           WHERE room_id = $1 AND nickname = $2 AND pin_hash IS NOT NULL
           ORDER BY created_at ASC`,
          [roomId, nickname.trim()],
        )
      : await this.pool.query<{
          id: string;
          nickname: string;
          client_token: string;
          pin_hash: string | null;
        }>(
          `SELECT id::text, nickname, client_token, pin_hash FROM participants
           WHERE room_id = $1 AND pin_hash IS NOT NULL
           ORDER BY created_at ASC`,
          [roomId],
        );

    // verifyPin 이 비동기(scrypt)라 순차 await — 방당 PIN 후보는 소수라 부담 없음.
    const matches: typeof candidates.rows = [];
    for (const row of candidates.rows) {
      if (await verifyPin(pin, row.pin_hash)) matches.push(row);
    }

    if (matches.length === 1) {
      const row = matches[0];
      this.pinFailures.delete(key);

      // 이 participant 가 방 주인으로 link 되어 있으면 creator_token 도 회수.
      const ownerRes = await this.pool.query<{ creator_token: string | null }>(
        `SELECT creator_token FROM rooms
         WHERE id = $1 AND creator_participant_id = $2`,
        [roomId, row.id],
      );
      const creatorToken =
        ownerRes.rowCount && ownerRes.rows[0].creator_token
          ? ownerRes.rows[0].creator_token
          : undefined;

      return {
        participantId: Number(row.id),
        clientToken: row.client_token, // 기존 토큰 그대로 — 다른 기기 client_token 무효화 X
        nickname: row.nickname,
        creatorToken,
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
        ts: now,
      });
    } else {
      this.pinFailures.set(key, { count: next, until: 0, ts: now });
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
    const me = await this.pool.query<{ id: string; nickname: string }>(
      `SELECT id::text, nickname FROM participants WHERE room_id = $1 AND client_token = $2`,
      [roomId, clientToken],
    );
    if (me.rowCount === 0) {
      throw new ForbiddenException('not a participant');
    }
    const participantId = Number(me.rows[0].id);
    const nickname = me.rows[0].nickname;

    // 후보 날짜만 인정 (다른 방의 dateId, 임의 id 차단)
    const allowed = await this.pool.query<{ id: string }>(
      `SELECT id::text FROM room_dates WHERE room_id = $1`,
      [roomId],
    );
    const allowedSet = new Set(allowed.rows.map((r) => Number(r.id)));
    const filtered = Array.from(new Set(dateIds)).filter((id) =>
      allowedSet.has(id),
    );

    // 가능 날짜를 고르는 건 곧 "참석하겠다"는 뜻 → 불참 플래그를 자동으로 해제한다.
    await withTransaction(this.pool, async (c) => {
      await c.query(`UPDATE participants SET declined = false WHERE id = $1`, [
        participantId,
      ]);
      await c.query(`DELETE FROM availabilities WHERE participant_id = $1`, [
        participantId,
      ]);
      if (filtered.length > 0) {
        await c.query(
          `INSERT INTO availabilities (participant_id, room_date_id)
           SELECT $1, unnest($2::bigint[])
           ON CONFLICT DO NOTHING`,
          [participantId, filtered],
        );
      }
    });

    this.realtime.emitResultsUpdated(roomId);
    // 실제 선택이 있을 때만 "투표" 이벤트 — 전체 해제(0개)는 피드에 안 남긴다.
    if (filtered.length > 0) {
      this.realtime.emitAdminEvent('voted', {
        roomId,
        nickname,
        count: filtered.length,
      });
    }
    return { dateIds: filtered };
  }

  // 사람 단위 불참 토글. declined=true 면 가능 날짜를 전부 비운다(참석 안 하니까).
  async setDeclined(
    roomId: string,
    clientToken: string | undefined,
    declined: boolean,
  ): Promise<{ declined: boolean }> {
    if (!clientToken) {
      throw new ForbiddenException('client token required');
    }
    const roomRes = await this.pool.query<{ deadline: Date | null }>(
      `SELECT deadline FROM rooms WHERE id = $1`,
      [roomId],
    );
    if (roomRes.rowCount === 0) throw new NotFoundException('room not found');
    const deadline = roomRes.rows[0].deadline;
    if (deadline && deadline.getTime() <= Date.now()) {
      throw new HttpException('room is locked', HttpStatus.LOCKED);
    }
    const me = await this.pool.query<{ id: string; nickname: string }>(
      `SELECT id::text, nickname FROM participants WHERE room_id = $1 AND client_token = $2`,
      [roomId, clientToken],
    );
    if (me.rowCount === 0) throw new ForbiddenException('not a participant');
    const participantId = Number(me.rows[0].id);
    const nickname = me.rows[0].nickname;

    await withTransaction(this.pool, async (c) => {
      // declined_at: 불참 처리 순간을 기록(활동 피드용). 참여로 되돌리면 NULL.
      await c.query(
        `UPDATE participants
            SET declined = $2,
                declined_at = CASE WHEN $2 THEN now() ELSE NULL END
          WHERE id = $1`,
        [participantId, declined],
      );
      if (declined) {
        // 불참이면 가능 날짜는 의미 없으니 비운다.
        await c.query(`DELETE FROM availabilities WHERE participant_id = $1`, [
          participantId,
        ]);
      }
    });

    this.realtime.emitResultsUpdated(roomId);
    this.realtime.emitAdminEvent(declined ? 'declined' : 'undeclined', {
      roomId,
      nickname,
    });
    return { declined };
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
    const me = await this.pool.query<{
      id: string;
      nickname: string;
      declined: boolean;
    }>(
      `SELECT id::text, nickname, declined FROM participants
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
      declined: me.rows[0].declined,
    };
  }
}
