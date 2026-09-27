import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import type { PlaceResult } from '@whenever/shared';
import { PLACES_PER_ROOM_MAX } from '@whenever/shared';
import { PG_POOL } from '../database/database.module';
import { withTransaction } from '../common/db.helpers';
import { normalizePlaceUrl } from '../common/place-url';
import { secureEquals } from '../common/secure-compare';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import type { AddPlaceDto } from './dto/place.dto';

export interface PlaceSnapshot {
  places: PlaceResult[];
  confirmedPlaceId: number | null;
  confirmedPlaceAt: string | null;
}

type Queryable = Pool | PoolClient;

// 장소·메뉴 투표. 날짜 투표와 같은 방에서 동시에 진행한다.
//
// 잠금 규칙 (날짜와 독립):
//   장소 쓰기 가능 = 마감 전 && 장소 미확정.  날짜 확정은 장소를 잠그지 않는다.
// 쓰기는 모두 트랜잭션 안에서 rooms 행을 FOR UPDATE 로 먼저 잡는다 —
// 확정/해제/후보 삭제/투표가 같은 행에서 직렬화돼, 확인→쓰기 사이에 확정이
// 끼어드는 TOCTOU 와 "19개에서 동시 추가 → 21개" 같은 한도 초과를 막는다.
// 잠금 순서는 항상 rooms → 참여자/후보 → 표.
@Injectable()
export class PlacesService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly realtime: RealtimeGateway,
  ) {}

  // 후보 목록 + 확정 상태를 한 쿼리(한 스냅샷)로. 확정 해제·삭제 도중에
  // "목록엔 없는데 확정 id 는 남은" 섞인 응답이 나가지 않게 한다.
  // 방이 없으면 null.
  async snapshot(roomId: string, q: Queryable = this.pool): Promise<PlaceSnapshot | null> {
    const res = await q.query<{
      confirmed_place_id: string | null;
      confirmed_place_at: Date | null;
      places: {
        id: number;
        name: string;
        url: string | null;
        memo: string | null;
        created_at: string;
        cb_id: number | null;
        cb_nickname: string | null;
        votes: number;
        voters: { id: number; nickname: string }[];
      }[];
    }>(
      // 불참자 표는 행을 남기되 집계·명단에서 뺀다 — JOIN 조건에 declined 를 넣고
      // COUNT(p.id) 로 세야 한다 (COUNT(pv.*) 면 불참자도 센다, WHERE 면 0표 후보가 사라진다).
      `SELECT r.confirmed_place_id::text AS confirmed_place_id,
              r.confirmed_place_at,
              COALESCE((
                SELECT jsonb_agg(to_jsonb(x) ORDER BY x.votes DESC, x.created_at ASC, x.id ASC)
                FROM (
                  SELECT rp.id, rp.name, rp.url, rp.memo, rp.created_at,
                         cb.id AS cb_id, cb.nickname AS cb_nickname,
                         COUNT(p.id)::int AS votes,
                         COALESCE(
                           jsonb_agg(
                             jsonb_build_object('id', p.id, 'nickname', p.nickname)
                             ORDER BY pv.created_at, p.id
                           ) FILTER (WHERE p.id IS NOT NULL),
                           '[]'::jsonb
                         ) AS voters
                  FROM room_places rp
                  LEFT JOIN participants cb ON cb.id = rp.created_by
                  LEFT JOIN place_votes pv ON pv.place_id = rp.id
                  LEFT JOIN participants p
                         ON p.id = pv.participant_id AND p.declined = false
                  WHERE rp.room_id = r.id
                  GROUP BY rp.id, cb.id
                ) x
              ), '[]'::jsonb) AS places
       FROM rooms r
       WHERE r.id = $1`,
      [roomId],
    );
    if (res.rowCount === 0) return null;
    const row = res.rows[0];
    return {
      confirmedPlaceId:
        row.confirmed_place_id != null ? Number(row.confirmed_place_id) : null,
      confirmedPlaceAt: row.confirmed_place_at
        ? row.confirmed_place_at.toISOString()
        : null,
      places: row.places.map((p) => ({
        placeId: Number(p.id),
        name: p.name,
        url: p.url,
        memo: p.memo,
        createdBy:
          p.cb_id != null
            ? { id: Number(p.cb_id), nickname: p.cb_nickname ?? '' }
            : null,
        votes: Number(p.votes),
        voters: p.voters.map((v) => ({ id: Number(v.id), nickname: v.nickname })),
        createdAt: new Date(p.created_at).toISOString(),
      })),
    };
  }

  async add(
    roomId: string,
    clientToken: string | undefined,
    dto: AddPlaceDto,
  ): Promise<{ placeId: number }> {
    if (!clientToken) throw new ForbiddenException('client token required');
    const url = normalizePlaceUrl(dto.url);
    const name = dto.name.trim();
    const memo = dto.memo?.trim() || null;
    if (!name) throw new BadRequestException('name required');

    const { placeId, nickname } = await withTransaction(this.pool, async (c) => {
      await lockPlacesWritable(c, roomId);
      const me = await findParticipant(c, roomId, clientToken);
      // 불참자는 안 오는 사람 — 후보를 올리거나 표를 던지면 참석자들의 결정이 흔들린다.
      if (me.declined) throw new ConflictException('participant declined');

      const cnt = await c.query<{ n: number; dup: boolean }>(
        `SELECT COUNT(*)::int AS n,
                COALESCE(bool_or(lower(name) = lower($2)), false) AS dup
           FROM room_places WHERE room_id = $1`,
        [roomId, name],
      );
      if (cnt.rows[0].dup) throw new ConflictException('duplicate place');
      if (cnt.rows[0].n >= PLACES_PER_ROOM_MAX) {
        throw new ConflictException('too many places');
      }
      const ins = await c.query<{ id: string }>(
        `INSERT INTO room_places (room_id, name, url, memo, created_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING id::text`,
        [roomId, name, url, memo, me.id],
      );
      const id = Number(ins.rows[0].id);
      // 올린 사람은 당연히 가고 싶은 곳 — 👍 를 같이 켠다 (본인이 끌 수 있다).
      await c.query(
        `INSERT INTO place_votes (participant_id, place_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [me.id, id],
      );
      return { placeId: id, nickname: me.nickname };
    });

    this.realtime.emitResultsUpdated(roomId);
    this.realtime.emitAdminEvent('place_added', { roomId, nickname, name });
    return { placeId };
  }

  // 후보 삭제 — 등록자 본인 또는 방장. 그 후보에 던진 다른 사람 표도 같이 사라진다.
  async remove(
    roomId: string,
    placeId: number,
    clientToken: string | undefined,
    creatorToken: string | undefined,
  ): Promise<{ deleted: true }> {
    if (!clientToken && !creatorToken) {
      throw new ForbiddenException('token required');
    }
    await withTransaction(this.pool, async (c) => {
      const room = await lockPlacesWritable(c, roomId);
      const place = await c.query<{ created_by: string | null }>(
        `SELECT created_by::text FROM room_places
          WHERE id = $1 AND room_id = $2 FOR UPDATE`,
        [placeId, roomId],
      );
      if (place.rowCount === 0) throw new NotFoundException('place not found');

      const isCreator =
        !!creatorToken && secureEquals(room.creator_token, creatorToken);
      if (!isCreator) {
        if (!clientToken) throw new ForbiddenException('not allowed');
        const me = await findParticipant(c, roomId, clientToken);
        const owner = place.rows[0].created_by;
        if (owner == null || Number(owner) !== me.id) {
          throw new ForbiddenException('not allowed');
        }
      }
      await c.query(`DELETE FROM room_places WHERE id = $1`, [placeId]);
    });
    this.realtime.emitResultsUpdated(roomId);
    return { deleted: true };
  }

  // 👍 켜기/끄기. PUT = "표 있음" 보장, DELETE = "표 없음" 보장 (멱등).
  async setVote(
    roomId: string,
    placeId: number,
    clientToken: string | undefined,
    on: boolean,
  ): Promise<{ placeId: number; voted: boolean }> {
    if (!clientToken) throw new ForbiddenException('client token required');
    await withTransaction(this.pool, async (c) => {
      await lockPlacesWritable(c, roomId);
      const me = await findParticipant(c, roomId, clientToken);
      if (me.declined) throw new ConflictException('participant declined');
      const place = await c.query(
        `SELECT 1 FROM room_places WHERE id = $1 AND room_id = $2`,
        [placeId, roomId],
      );
      if (place.rowCount === 0) throw new NotFoundException('place not found');
      if (on) {
        await c.query(
          `INSERT INTO place_votes (participant_id, place_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [me.id, placeId],
        );
      } else {
        await c.query(
          `DELETE FROM place_votes WHERE participant_id = $1 AND place_id = $2`,
          [me.id, placeId],
        );
      }
    });
    this.realtime.emitResultsUpdated(roomId);
    return { placeId, voted: on };
  }

  // 장소 확정 (방장). 날짜 확정과 같은 규칙 — 마감이 지나도 확정할 수 있다.
  // 같은 후보 재확정은 멱등(확정 시각 유지), 다른 후보면 바꾼다.
  async confirm(
    roomId: string,
    creatorToken: string | undefined,
    placeId: number,
  ): Promise<{ confirmedPlaceId: number }> {
    if (!creatorToken) throw new ForbiddenException('creator token required');
    const name = await withTransaction(this.pool, async (c) => {
      const room = await lockRoom(c, roomId);
      if (!secureEquals(room.creator_token, creatorToken)) {
        throw new ForbiddenException('not the creator');
      }
      const place = await c.query<{ name: string }>(
        `SELECT name FROM room_places WHERE id = $1 AND room_id = $2`,
        [placeId, roomId],
      );
      if (place.rowCount === 0) {
        throw new BadRequestException('place is not a candidate of this room');
      }
      await c.query(
        `UPDATE rooms
            SET confirmed_place_at = CASE WHEN confirmed_place_id = $1
                                          THEN confirmed_place_at ELSE now() END,
                confirmed_place_id = $1
          WHERE id = $2`,
        [placeId, roomId],
      );
      return place.rows[0].name;
    });
    this.realtime.emitResultsUpdated(roomId);
    this.realtime.emitAdminEvent('place_confirmed', { roomId, name });
    return { confirmedPlaceId: placeId };
  }

  async unconfirm(
    roomId: string,
    creatorToken: string | undefined,
  ): Promise<{ confirmedPlaceId: null }> {
    if (!creatorToken) throw new ForbiddenException('creator token required');
    await withTransaction(this.pool, async (c) => {
      const room = await lockRoom(c, roomId);
      if (!secureEquals(room.creator_token, creatorToken)) {
        throw new ForbiddenException('not the creator');
      }
      await c.query(
        `UPDATE rooms SET confirmed_place_id = NULL, confirmed_place_at = NULL
          WHERE id = $1`,
        [roomId],
      );
    });
    this.realtime.emitResultsUpdated(roomId);
    return { confirmedPlaceId: null };
  }
}

interface LockedRoom {
  creator_token: string | null;
  deadline: Date | null;
  confirmed_place_id: string | null;
}

async function lockRoom(c: PoolClient, roomId: string): Promise<LockedRoom> {
  const r = await c.query<LockedRoom>(
    `SELECT creator_token, deadline, confirmed_place_id::text
       FROM rooms WHERE id = $1 FOR UPDATE`,
    [roomId],
  );
  if (r.rowCount === 0) throw new NotFoundException('room not found');
  return r.rows[0];
}

// 장소 쓰기(후보 추가·삭제·투표) 가능 여부. 날짜 확정은 보지 않는다.
async function lockPlacesWritable(
  c: PoolClient,
  roomId: string,
): Promise<LockedRoom> {
  const room = await lockRoom(c, roomId);
  if (room.deadline && room.deadline.getTime() <= Date.now()) {
    throw new HttpException('room is locked', HttpStatus.LOCKED);
  }
  if (room.confirmed_place_id != null) {
    throw new HttpException('place is confirmed', HttpStatus.LOCKED);
  }
  return room;
}

async function findParticipant(
  c: PoolClient,
  roomId: string,
  clientToken: string,
): Promise<{ id: number; nickname: string; declined: boolean }> {
  const me = await c.query<{ id: string; nickname: string; declined: boolean }>(
    `SELECT id::text, nickname, declined FROM participants
      WHERE room_id = $1 AND client_token = $2`,
    [roomId, clientToken],
  );
  if (me.rowCount === 0) throw new ForbiddenException('not a participant');
  return {
    id: Number(me.rows[0].id),
    nickname: me.rows[0].nickname,
    declined: me.rows[0].declined,
  };
}
