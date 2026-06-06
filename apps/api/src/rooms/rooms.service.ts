import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';
import type {
  CreateRoomResponse,
  DateResult,
  RoomDetail,
} from '@whenever/shared';
import { PG_POOL } from '../database/database.module';
import { withTransaction } from '../common/db.helpers';
import { newRoomId, newToken } from '../common/ids';
import { secureEquals } from '../common/secure-compare';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import type { CreateRoomDto } from './dto/create-room.dto';

@Injectable()
export class RoomsService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly realtime: RealtimeGateway,
  ) {}

  async create(dto: CreateRoomDto): Promise<CreateRoomResponse> {
    // 생성 시점에 이미 지난 마감일이면 만들자마자 잠긴 방이 되므로 거부.
    if (dto.deadline && new Date(dto.deadline).getTime() <= Date.now()) {
      throw new BadRequestException('deadline must be in the future');
    }
    const roomId = newRoomId();
    const creatorToken = newToken();

    await withTransaction(this.pool, async (c) => {
      await c.query(
        `INSERT INTO rooms (id, title, creator_token, deadline)
         VALUES ($1, $2, $3, $4)`,
        [roomId, dto.title, creatorToken, dto.deadline ?? null],
      );

      const uniqueDates = Array.from(new Set(dto.dates));
      for (const d of uniqueDates) {
        await c.query(
          `INSERT INTO room_dates (room_id, the_date) VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [roomId, d],
        );
      }
    });

    this.realtime.emitAdminEvent('room_created', { roomId, title: dto.title });
    return { roomId, creatorToken };
  }

  async getDetail(roomId: string): Promise<RoomDetail> {
    const roomRes = await this.pool.query<{
      id: string;
      title: string;
      deadline: Date | null;
      created_at: Date;
    }>(`SELECT id, title, deadline, created_at FROM rooms WHERE id = $1`, [
      roomId,
    ]);
    if (roomRes.rowCount === 0) {
      throw new NotFoundException('room not found');
    }
    const room = roomRes.rows[0];

    const datesRes = await this.pool.query<{ id: string; the_date: string }>(
      `SELECT id::text, to_char(the_date, 'YYYY-MM-DD') AS the_date
       FROM room_dates
       WHERE room_id = $1 ORDER BY the_date ASC`,
      [roomId],
    );

    const partCountRes = await this.pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM participants WHERE room_id = $1`,
      [roomId],
    );

    const results = await this.computeResults(roomId);

    return {
      id: room.id,
      title: room.title,
      deadline: room.deadline ? room.deadline.toISOString() : null,
      createdAt: room.created_at.toISOString(),
      dates: datesRes.rows.map((r) => ({
        id: Number(r.id),
        date: r.the_date,
      })),
      participantCount: Number(partCountRes.rows[0].c),
      results,
    };
  }

  async getResults(roomId: string): Promise<{
    results: DateResult[];
    participantCount: number;
    deadline: string | null;
  }> {
    const roomRes = await this.pool.query<{ deadline: Date | null }>(
      `SELECT deadline FROM rooms WHERE id = $1`,
      [roomId],
    );
    if (roomRes.rowCount === 0) {
      throw new NotFoundException('room not found');
    }
    const partCountRes = await this.pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM participants WHERE room_id = $1`,
      [roomId],
    );
    const results = await this.computeResults(roomId);
    return {
      results,
      participantCount: Number(partCountRes.rows[0].c),
      deadline: roomRes.rows[0].deadline
        ? roomRes.rows[0].deadline.toISOString()
        : null,
    };
  }

  async buildWinnerIcs(roomId: string): Promise<string> {
    const detail = await this.getDetail(roomId);
    const winner = detail.results[0];
    if (!winner || winner.votes === 0) {
      throw new NotFoundException('no winner yet');
    }
    const date = winner.date.replace(/-/g, ''); // YYYYMMDD
    const endDate = nextDay(winner.date).replace(/-/g, '');
    const now = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
    const summary = escapeIcsText(detail.title);
    const description = escapeIcsText(
      `Whenever 투표 1위 (${winner.votes}표). 방 ID ${detail.id}.`,
    );

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//whenever//ko//',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:winner-${detail.id}-${winner.dateId}@whenever`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${date}`,
      `DTEND;VALUE=DATE:${endDate}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
      'END:VCALENDAR',
      '',
    ].join('\r\n');
  }

  async updateDeadline(
    roomId: string,
    creatorToken: string | undefined,
    deadline: string | null,
  ): Promise<{ deadline: string | null }> {
    if (!creatorToken) {
      throw new ForbiddenException('creator token required');
    }
    const roomRes = await this.pool.query<{ creator_token: string | null }>(
      `SELECT creator_token FROM rooms WHERE id = $1`,
      [roomId],
    );
    if (roomRes.rowCount === 0) {
      throw new NotFoundException('room not found');
    }
    if (!secureEquals(roomRes.rows[0].creator_token, creatorToken)) {
      throw new ForbiddenException('not the creator');
    }
    await this.pool.query(`UPDATE rooms SET deadline = $1 WHERE id = $2`, [
      deadline,
      roomId,
    ]);
    this.realtime.emitDeadlineUpdated(roomId, deadline);
    return { deadline };
  }

  private async computeResults(roomId: string): Promise<DateResult[]> {
    // 기획서 7장 집계 쿼리 + 누가 가능한지 닉네임 배열.
    const res = await this.pool.query<{
      date_id: string;
      the_date: string;
      votes: string;
      voters: { id: number; nickname: string }[] | null;
    }>(
      `SELECT rd.id::text AS date_id,
              to_char(rd.the_date, 'YYYY-MM-DD') AS the_date,
              COUNT(a.participant_id)::text AS votes,
              COALESCE(
                jsonb_agg(
                  jsonb_build_object('id', p.id, 'nickname', p.nickname)
                  ORDER BY p.created_at
                ) FILTER (WHERE p.id IS NOT NULL),
                '[]'::jsonb
              ) AS voters
       FROM room_dates rd
       LEFT JOIN availabilities a ON a.room_date_id = rd.id
       LEFT JOIN participants   p ON p.id           = a.participant_id
       WHERE rd.room_id = $1
       GROUP BY rd.id, rd.the_date
       ORDER BY COUNT(a.participant_id) DESC, rd.the_date ASC`,
      [roomId],
    );
    return res.rows.map((r) => ({
      dateId: Number(r.date_id),
      date: r.the_date,
      votes: Number(r.votes),
      voters: r.voters ?? [],
    }));
  }
}

function nextDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return dt.toISOString().slice(0, 10);
}

function escapeIcsText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}
