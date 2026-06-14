import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
  dailyVotes: { day: string; count: number }[];
  hourlyJoins: { hour: number; count: number }[];
  weeklyVotes: { dow: number; count: number }[];
  topActiveRooms: {
    id: string;
    title: string;
    participantCount: number;
    createdAt: string;
  }[];
  recentActions: { id: number; action: string; createdAt: string }[];
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

export interface AdminAction {
  id: number;
  action: string;
  roomId: string | null;
  participantId: number | null;
  payload: unknown;
  createdAt: string;
}

@Injectable()
export class AdminService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly realtime: RealtimeGateway,
  ) {}

  // ───────────────────────────── stats ─────────────────────────────
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

    const dailyCreated = await this.pool.query<{ day: string; count: string }>(`
      SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
             COUNT(*)::text AS count
      FROM rooms
      WHERE created_at >= now() - interval '30 days'
      GROUP BY day ORDER BY day
    `);

    const dailyVotes = await this.pool.query<{ day: string; count: string }>(`
      SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
             COUNT(*)::text AS count
      FROM availabilities
      WHERE created_at >= now() - interval '30 days'
      GROUP BY day ORDER BY day
    `);

    // KST 기준 시간대별 참여자 입장 (최근 30일)
    const hourlyJoins = await this.pool.query<{ hour: string; count: string }>(`
      SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Seoul')::int::text AS hour,
             COUNT(*)::text AS count
      FROM participants
      WHERE created_at >= now() - interval '30 days'
      GROUP BY hour ORDER BY hour
    `);

    // 요일별 후보 날짜 인기 (1=월 ~ 7=일)
    const weeklyVotes = await this.pool.query<{ dow: string; count: string }>(`
      SELECT EXTRACT(ISODOW FROM rd.the_date)::int::text AS dow,
             COUNT(*)::text AS count
      FROM availabilities a
      JOIN room_dates rd ON rd.id = a.room_date_id
      GROUP BY dow ORDER BY dow
    `);

    const topActiveRooms = await this.pool.query<{
      id: string;
      title: string;
      participant_count: string;
      created_at: Date;
    }>(`
      SELECT r.id, r.title,
             COALESCE(COUNT(p.id), 0)::text AS participant_count,
             r.created_at
      FROM rooms r
      LEFT JOIN participants p ON p.room_id = r.id
      WHERE r.created_at >= now() - interval '7 days'
      GROUP BY r.id
      ORDER BY COUNT(p.id) DESC, r.created_at DESC
      LIMIT 5
    `);

    const recentActions = await this.pool.query<{
      id: string;
      action: string;
      created_at: Date;
    }>(`
      SELECT id::text, action, created_at
      FROM admin_actions
      ORDER BY created_at DESC
      LIMIT 5
    `);

    return {
      totalRooms: Number(kpi.rows[0].total_rooms),
      totalParticipants: Number(kpi.rows[0].total_participants),
      totalVotes: Number(kpi.rows[0].total_votes),
      avgParticipantsPerRoom: Number(avg.rows[0].avg ?? 0),
      activeRooms: Number(status.rows[0].active),
      closedRooms: Number(status.rows[0].closed),
      roomsWithDeadline: Number(status.rows[0].with_deadline),
      dailyCreated: dailyCreated.rows.map((r) => ({
        day: r.day,
        count: Number(r.count),
      })),
      dailyVotes: dailyVotes.rows.map((r) => ({
        day: r.day,
        count: Number(r.count),
      })),
      hourlyJoins: hourlyJoins.rows.map((r) => ({
        hour: Number(r.hour),
        count: Number(r.count),
      })),
      weeklyVotes: weeklyVotes.rows.map((r) => ({
        dow: Number(r.dow),
        count: Number(r.count),
      })),
      topActiveRooms: topActiveRooms.rows.map((r) => ({
        id: r.id,
        title: r.title,
        participantCount: Number(r.participant_count),
        createdAt: r.created_at.toISOString(),
      })),
      recentActions: recentActions.rows.map((r) => ({
        id: Number(r.id),
        action: r.action,
        createdAt: r.created_at.toISOString(),
      })),
    };
  }

  // ───────────────────────────── rooms ─────────────────────────────
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
      // ILIKE 와일드카드 (`%` `_`) escape — 어드민이 `%%%` 같은 입력으로
      // 와일드카드 폭주를 일으키지 않도록.
      const escaped = q.replace(/\\/g, '\\\\').replace(/[%_]/g, '\\$&');
      params.push(`%${escaped}%`);
      where.push(
        `(r.title ILIKE $${params.length} ESCAPE '\\' OR r.id ILIKE $${params.length} ESCAPE '\\')`,
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
    const r = await this.pool.query<{ title: string }>(
      `SELECT title FROM rooms WHERE id = $1`,
      [roomId],
    );
    if (r.rowCount === 0) throw new NotFoundException('room not found');
    await this.pool.query(`DELETE FROM rooms WHERE id = $1`, [roomId]);
    await this.logAction('delete_room', roomId, null, {
      title: r.rows[0].title,
    });
    this.realtime.emitRoomDeleted(roomId);
    this.realtime.emitAdminEvent('room_deleted', { roomId });
    return { deleted: true };
  }

  async updateRoomDeadline(
    roomId: string,
    deadline: string | null,
  ): Promise<{ deadline: string | null }> {
    const r = await this.pool.query<{ deadline: Date | null }>(
      `SELECT deadline FROM rooms WHERE id = $1`,
      [roomId],
    );
    if (r.rowCount === 0) throw new NotFoundException('room not found');
    if (deadline && new Date(deadline).getTime() <= Date.now()) {
      throw new BadRequestException('deadline must be in the future');
    }
    await this.pool.query(`UPDATE rooms SET deadline = $1 WHERE id = $2`, [
      deadline,
      roomId,
    ]);
    await this.logAction('update_deadline', roomId, null, {
      from: r.rows[0].deadline ? r.rows[0].deadline.toISOString() : null,
      to: deadline,
    });
    this.realtime.emitDeadlineUpdated(roomId, deadline);
    this.realtime.emitAdminEvent('deadline_updated', { roomId, deadline });
    return { deadline };
  }

  async kickParticipant(
    roomId: string,
    participantId: number,
  ): Promise<{ deleted: boolean }> {
    const r = await this.pool.query<{ nickname: string }>(
      `SELECT nickname FROM participants WHERE id = $1 AND room_id = $2`,
      [participantId, roomId],
    );
    if (r.rowCount === 0)
      throw new NotFoundException('participant not found in this room');
    await this.pool.query(`DELETE FROM participants WHERE id = $1`, [
      participantId,
    ]);
    await this.logAction('kick_participant', roomId, participantId, {
      nickname: r.rows[0].nickname,
    });
    this.realtime.emitResultsUpdated(roomId);
    this.realtime.emitAdminEvent('participant_kicked', {
      roomId,
      participantId,
      nickname: r.rows[0].nickname,
    });
    return { deleted: true };
  }

  // ─────────────────────────── action logs ───────────────────────────
  async listActions(opts: { limit?: number; offset?: number }): Promise<{
    actions: AdminAction[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
    const offset = Math.max(opts.offset ?? 0, 0);
    const totalRes = await this.pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM admin_actions`,
    );
    const list = await this.pool.query<{
      id: string;
      action: string;
      room_id: string | null;
      participant_id: string | null;
      payload: unknown;
      created_at: Date;
    }>(
      `SELECT id::text, action, room_id, participant_id::text, payload, created_at
       FROM admin_actions
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return {
      total: Number(totalRes.rows[0].c),
      limit,
      offset,
      actions: list.rows.map((r) => ({
        id: Number(r.id),
        action: r.action,
        roomId: r.room_id,
        participantId:
          r.participant_id != null ? Number(r.participant_id) : null,
        payload: r.payload,
        createdAt: r.created_at.toISOString(),
      })),
    };
  }

  // ───────────────────────────── cleanup ─────────────────────────────
  async cleanupOldRooms(
    olderThanDays: number,
  ): Promise<{ removed: number; days: number }> {
    const days = Math.max(1, Math.floor(olderThanDays));
    const res = await this.pool.query(
      `DELETE FROM rooms WHERE created_at < now() - ($1::int * interval '1 day')`,
      [days],
    );
    const removed = res.rowCount ?? 0;
    await this.logAction('cleanup', null, null, { days, removed });
    return { removed, days };
  }

  // ───────────────────────────── exports ─────────────────────────────
  async exportRoomsCsv(): Promise<string> {
    const r = await this.pool.query<{
      id: string;
      title: string;
      created_at: Date;
      deadline: Date | null;
      participant_count: string;
      vote_count: string;
    }>(`
      SELECT r.id, r.title, r.created_at, r.deadline,
             COALESCE(pc.cnt, 0)::text AS participant_count,
             COALESCE(vc.cnt, 0)::text AS vote_count
      FROM rooms r
      LEFT JOIN (SELECT room_id, COUNT(*) AS cnt FROM participants GROUP BY room_id) pc ON pc.room_id = r.id
      LEFT JOIN (
        SELECT p.room_id, COUNT(*) AS cnt
        FROM availabilities a JOIN participants p ON p.id = a.participant_id
        GROUP BY p.room_id
      ) vc ON vc.room_id = r.id
      ORDER BY r.created_at DESC
    `);
    const header = [
      'id',
      'title',
      'created_at',
      'deadline',
      'participants',
      'votes',
    ];
    const rows = r.rows.map((row) => [
      row.id,
      csvEscape(row.title),
      row.created_at.toISOString(),
      row.deadline ? row.deadline.toISOString() : '',
      row.participant_count,
      row.vote_count,
    ]);
    return (
      [header.join(','), ...rows.map((r) => r.join(','))].join('\n') + '\n'
    );
  }

  async exportRoomCsv(roomId: string): Promise<string> {
    const exists = await this.pool.query(`SELECT 1 FROM rooms WHERE id = $1`, [
      roomId,
    ]);
    if (exists.rowCount === 0) throw new NotFoundException('room not found');

    // 참여자 × 후보 날짜 매트릭스 (1 = 가능, 0 = 불가)
    const dates = await this.pool.query<{ id: string; the_date: string }>(
      `SELECT id::text, to_char(the_date, 'YYYY-MM-DD') AS the_date
       FROM room_dates WHERE room_id = $1 ORDER BY the_date ASC`,
      [roomId],
    );
    const participants = await this.pool.query<{
      id: string;
      nickname: string;
      created_at: Date;
    }>(
      `SELECT id::text, nickname, created_at
       FROM participants WHERE room_id = $1 ORDER BY created_at ASC`,
      [roomId],
    );
    const avail = await this.pool.query<{
      participant_id: string;
      room_date_id: string;
    }>(
      `SELECT a.participant_id::text, a.room_date_id::text
       FROM availabilities a
       JOIN participants p ON p.id = a.participant_id
       WHERE p.room_id = $1`,
      [roomId],
    );

    const grid = new Map<string, Set<string>>();
    for (const a of avail.rows) {
      if (!grid.has(a.participant_id)) grid.set(a.participant_id, new Set());
      grid.get(a.participant_id)!.add(a.room_date_id);
    }

    const header = [
      'participant_id',
      'nickname',
      'joined_at',
      ...dates.rows.map((d) => d.the_date),
    ];
    const rows = participants.rows.map((p) => {
      const av = grid.get(p.id) ?? new Set();
      return [
        p.id,
        csvEscape(p.nickname),
        p.created_at.toISOString(),
        ...dates.rows.map((d) => (av.has(d.id) ? '1' : '0')),
      ];
    });
    return (
      [header.join(','), ...rows.map((r) => r.join(','))].join('\n') + '\n'
    );
  }

  // ─────────────────────────── logAction ───────────────────────────
  private async logAction(
    action: string,
    roomId: string | null,
    participantId: number | null,
    payload: Record<string, unknown> | null,
  ): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO admin_actions (action, room_id, participant_id, payload)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [
          action,
          roomId,
          participantId,
          payload ? JSON.stringify(payload) : null,
        ],
      );
    } catch {
      // 로그 실패가 어드민 작업 자체를 막지는 않게 한다.
    }
  }
}

function csvEscape(s: string): string {
  // CSV formula injection 방어 — `=` `+` `-` `@` `\t` `\r` 로 시작하면 Excel/Sheets 가
  // 수식으로 해석. 닉네임이 `=cmd|...` 이면 임의 명령 실행 위험 → 작은따옴표 prefix.
  // (Google 권장: https://owasp.org/www-community/attacks/CSV_Injection)
  let v = s;
  if (/^[=+\-@\t\r]/.test(v)) {
    v = `'${v}`;
  }
  if (v.includes(',') || v.includes('"') || v.includes('\n') || v.includes('\r')) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}
