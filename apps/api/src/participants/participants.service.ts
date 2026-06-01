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

@Injectable()
export class ParticipantsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async join(roomId: string, nickname: string): Promise<JoinRoomResponse> {
    const roomRes = await this.pool.query('SELECT 1 FROM rooms WHERE id = $1', [roomId]);
    if (roomRes.rowCount === 0) {
      throw new NotFoundException('room not found');
    }
    const clientToken = newToken();
    const res = await this.pool.query<{ id: string }>(
      `INSERT INTO participants (room_id, nickname, client_token)
       VALUES ($1, $2, $3)
       RETURNING id::text`,
      [roomId, nickname.trim(), clientToken],
    );
    return { participantId: Number(res.rows[0].id), clientToken };
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
    const filtered = Array.from(new Set(dateIds)).filter((id) => allowedSet.has(id));

    await withTransaction(this.pool, async (c) => {
      await c.query(`DELETE FROM availabilities WHERE participant_id = $1`, [participantId]);
      for (const id of filtered) {
        await c.query(
          `INSERT INTO availabilities (participant_id, room_date_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [participantId, id],
        );
      }
    });

    return { dateIds: filtered };
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
