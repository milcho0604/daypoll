import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import { RealtimeGateway } from '../realtime/realtime.gateway';

export interface AdminStats {
  totalRooms: number;
  totalParticipants: number;
  totalVotes: number;
  avgParticipantsPerRoom: number;
  activeRooms: number;
  closedRooms: number;
  roomsWithDeadline: number;
  dailyCreated: { day: string; count: number }[];
}

export interface AdminRoomListItem {
  id: string;
  title: string;
  createdAt: string;
  participantCount: number;
  deadline: string | null;
  status: 'active' | 'closed';
}

export interface AdminRoomList {
  rooms: AdminRoomListItem[];
  total: number;
  limit: number;
  offset: number;
}

@Injectable()
export class AdminService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly realtime: RealtimeGateway,
  ) {}

  async getStats(): Promise<AdminStats> {
    const kpi = await this.pool.query<{
      total_rooms: string;
      total_participants: string;
      total_votes: string;
    }>(`
      SELECT
        (SELECT COUNT(*) FROM rooms)::text          AS total_rooms,
        (SELECT COUNT(*) FROM participants)::text   AS total_participants,
        (SELECT COUNT(*) FROM availabilities)::text AS total_votes
    `);

    const avg = await this.pool.query<{ avg: string | null }>(`
      SELECT ROUND(AVG(cnt)::numeric, 2)::text AS avg
      FROM (SELECT room_id, COUNT(*) AS cnt FROM participants GROUP BY room_id) t
    `);

    const status = await this.pool.query<{
      active: string;
      closed: string;
      with_deadline: string;
    }>(`
      SELECT
        COUNT(*) FILTER (WHERE deadline IS NULL OR deadline > now())::text       AS active,
        COUNT(*) FILTER (WHERE deadline IS NOT NULL AND deadline <= now())::text AS closed,
        COUNT(*) FILTER (WHERE deadline IS NOT NULL)::text                       AS with_deadline
      FROM rooms
    `);

    const daily = await this.pool.query<{ day: string; count: string }>(`
      SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
             COUNT(*)::text AS count
      FROM rooms
      WHERE created_at >= now() - interval '30 days'
      GROUP BY day
      ORDER BY day
    `);

    return {
      totalRooms: Number(kpi.rows[0].total_rooms),
      totalParticipants: Number(kpi.rows[0].total_participants),
      totalVotes: Number(kpi.rows[0].total_votes),
      avgParticipantsPerRoom: Number(avg.rows[0].avg ?? 0),
      activeRooms: Number(status.rows[0].active),
      closedRooms: Number(status.rows[0].closed),
      roomsWithDeadline: Number(status.rows[0].with_deadline),
      dailyCreated: daily.rows.map((r) => ({
        day: r.day,
        count: Number(r.count),
      })),
    };
  }

  async listRooms(opts: {
    limit?: number;
    offset?: number;
    order?: 'recent' | 'participants';
    q?: string;
  }): Promise<AdminRoomList> {
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
    const offset = Math.max(opts.offset ?? 0, 0);
    const order = opts.order === 'participants' ? 'participants' : 'recent';
    const q = (opts.q ?? '').trim();

    const where: string[] = [];
    const params: unknown[] = [];
    if (q.length > 0) {
      params.push(`%${q}%`);
      where.push(
        `(r.title ILIKE $${params.length} OR r.id ILIKE $${params.length})`,
      );
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const orderSql =
      order === 'participants'
        ? `ORDER BY participant_count DESC, r.created_at DESC`
        : `ORDER BY r.created_at DESC`;

    const totalRes = await this.pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM rooms r ${whereSql}`,
      params,
    );

    const dataParams = [...params, limit, offset];
    const list = await this.pool.query<{
      id: string;
      title: string;
      created_at: Date;
      participant_count: string;
      deadline: Date | null;
    }>(
      `SELECT r.id, r.title, r.created_at,
              COALESCE(p.cnt, 0)::text AS participant_count,
              r.deadline
       FROM rooms r
       LEFT JOIN (
         SELECT room_id, COUNT(*) AS cnt FROM participants GROUP BY room_id
       ) p ON p.room_id = r.id
       ${whereSql}
       ${orderSql}
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams,
    );

    return {
      total: Number(totalRes.rows[0].c),
      limit,
      offset,
      rooms: list.rows.map((r) => ({
        id: r.id,
        title: r.title,
        createdAt: r.created_at.toISOString(),
        participantCount: Number(r.participant_count),
        deadline: r.deadline ? r.deadline.toISOString() : null,
        status:
          r.deadline && r.deadline.getTime() <= Date.now()
            ? 'closed'
            : 'active',
      })),
    };
  }

  async getRoomDetail(roomId: string) {
    const roomRes = await this.pool.query<{
      id: string;
      title: string;
      deadline: Date | null;
      created_at: Date;
      creator_token: string | null;
    }>(
      `SELECT id, title, deadline, created_at, creator_token FROM rooms WHERE id = $1`,
      [roomId],
    );
    if (roomRes.rowCount === 0) throw new NotFoundException('room not found');
    const room = roomRes.rows[0];

    const dates = await this.pool.query<{
      id: string;
      the_date: string;
      votes: string;
      voters: string[] | null;
    }>(
      `SELECT rd.id::text,
              to_char(rd.the_date, 'YYYY-MM-DD') AS the_date,
              COUNT(a.participant_id)::text AS votes,
              COALESCE(ARRAY_AGG(p.nickname ORDER BY p.created_at)
                       FILTER (WHERE p.id IS NOT NULL), '{}') AS voters
       FROM room_dates rd
       LEFT JOIN availabilities a ON a.room_date_id = rd.id
       LEFT JOIN participants   p ON p.id           = a.participant_id
       WHERE rd.room_id = $1
       GROUP BY rd.id, rd.the_date
       ORDER BY COUNT(a.participant_id) DESC, rd.the_date ASC`,
      [roomId],
    );

    const participants = await this.pool.query<{
      id: string;
      nickname: string;
      created_at: Date;
      vote_count: string;
    }>(
      `SELECT p.id::text, p.nickname, p.created_at,
              COALESCE(COUNT(a.room_date_id), 0)::text AS vote_count
       FROM participants p
       LEFT JOIN availabilities a ON a.participant_id = p.id
       WHERE p.room_id = $1
       GROUP BY p.id
       ORDER BY p.created_at ASC`,
      [roomId],
    );

    return {
      id: room.id,
      title: room.title,
      deadline: room.deadline ? room.deadline.toISOString() : null,
      createdAt: room.created_at.toISOString(),
      hasCreator: !!room.creator_token,
      dates: dates.rows.map((r) => ({
        dateId: Number(r.id),
        date: r.the_date,
        votes: Number(r.votes),
        voters: r.voters ?? [],
      })),
      participants: participants.rows.map((p) => ({
        id: Number(p.id),
        nickname: p.nickname,
        createdAt: p.created_at.toISOString(),
        voteCount: Number(p.vote_count),
      })),
    };
  }

  async deleteRoom(roomId: string): Promise<{ deleted: boolean }> {
    const res = await this.pool.query(`DELETE FROM rooms WHERE id = $1`, [
      roomId,
    ]);
    if (res.rowCount === 0) throw new NotFoundException('room not found');
    this.realtime.emitRoomDeleted(roomId);
    return { deleted: true };
  }

  async cleanupOldRooms(
    olderThanDays: number,
  ): Promise<{ removed: number; days: number }> {
    const days = Math.max(1, Math.floor(olderThanDays));
    const res = await this.pool.query(
      `DELETE FROM rooms WHERE created_at < now() - ($1::int * interval '1 day')`,
      [days],
    );
    return { removed: res.rowCount ?? 0, days };
  }
}
