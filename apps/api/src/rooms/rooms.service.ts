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
  RegionCode,
  RoomDetail,
  RoomWeather,
} from '@whenever/shared';
import { regionLabel } from '@whenever/shared';
import { PG_POOL } from '../database/database.module';
import { withTransaction } from '../common/db.helpers';
import { newRoomId, newToken } from '../common/ids';
import { secureEquals } from '../common/secure-compare';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import type { CreateRoomDto } from './dto/create-room.dto';
import { WeatherService } from './weather.service';

@Injectable()
export class RoomsService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly realtime: RealtimeGateway,
    private readonly weather: WeatherService,
  ) {}

  async create(dto: CreateRoomDto): Promise<CreateRoomResponse> {
    // 생성 시점에 이미 지난 마감일이면 만들자마자 잠긴 방이 되므로 거부.
    if (dto.deadline && new Date(dto.deadline).getTime() <= Date.now()) {
      throw new BadRequestException('deadline must be in the future');
    }
    const roomId = newRoomId();
    const creatorToken = newToken();

    const createdBy = dto.createdBy?.trim() || null;
    const region = dto.region ?? null;

    await withTransaction(this.pool, async (c) => {
      await c.query(
        `INSERT INTO rooms (id, title, creator_token, deadline, created_by, region)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          roomId,
          dto.title,
          creatorToken,
          dto.deadline ?? null,
          createdBy,
          region,
        ],
      );

      const uniqueDates = Array.from(new Set(dto.dates));
      if (uniqueDates.length > 0) {
        await c.query(
          `INSERT INTO room_dates (room_id, the_date)
           SELECT $1, unnest($2::date[])
           ON CONFLICT DO NOTHING`,
          [roomId, uniqueDates],
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
      created_by: string | null;
      region: string | null;
    }>(
      `SELECT id, title, deadline, created_at, created_by, region FROM rooms WHERE id = $1`,
      [roomId],
    );
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
      createdBy: room.created_by ?? undefined,
      region: (room.region as RegionCode | null) ?? null,
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
    region: RegionCode | null;
  }> {
    const roomRes = await this.pool.query<{
      deadline: Date | null;
      region: string | null;
    }>(`SELECT deadline, region FROM rooms WHERE id = $1`, [roomId]);
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
      region: (roomRes.rows[0].region as RegionCode | null) ?? null,
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

  // 개설자가 방 생성 후 지역(날씨)을 켜거나 끄거나 바꾼다. creator_token 인증은 마감일과 동일.
  async updateRegion(
    roomId: string,
    creatorToken: string | undefined,
    region: RegionCode | null,
  ): Promise<{ region: RegionCode | null }> {
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
    await this.pool.query(`UPDATE rooms SET region = $1 WHERE id = $2`, [
      region,
      roomId,
    ]);
    // 이미 방을 열어둔 참여자들도 새로고침 없이 날씨 카드가 뜨거나 사라지게.
    this.realtime.emitRegionUpdated(roomId, region);
    return { region };
  }

  // 방의 후보날짜 중 예보 범위(약 16일) 안에 드는 날의 날씨. 지역 미설정이면 빈 결과.
  async getWeather(roomId: string): Promise<RoomWeather> {
    const roomRes = await this.pool.query<{ region: string | null }>(
      `SELECT region FROM rooms WHERE id = $1`,
      [roomId],
    );
    if (roomRes.rowCount === 0) {
      throw new NotFoundException('room not found');
    }
    const region = (roomRes.rows[0].region as RegionCode | null) ?? null;
    if (!region) {
      return { region: null, regionLabel: null, days: [] };
    }
    const datesRes = await this.pool.query<{ the_date: string }>(
      `SELECT to_char(the_date, 'YYYY-MM-DD') AS the_date
       FROM room_dates WHERE room_id = $1 ORDER BY the_date ASC`,
      [roomId],
    );
    const days = await this.weather.forDates(
      region,
      datesRes.rows.map((r) => r.the_date),
    );
    return { region, regionLabel: regionLabel(region), days };
  }

  private async computeResults(roomId: string): Promise<DateResult[]> {
    // 기획서 7장 집계 쿼리 + 누가 가능/불가능한지 닉네임 배열.
    //
    // 순위: 가능 수 DESC → 불가능 수 ASC → 날짜 ASC.
    // 불가능은 점수를 깎지 않고 동점일 때만 가른다. (가능 5·불가능 2) 가
    // (가능 3·불가능 0) 에 지는 건 친구 모임 직관과 어긋나서 감점 방식은 안 씀.
    const res = await this.pool.query<{
      date_id: string;
      the_date: string;
      votes: string;
      no_votes: string;
      voters: { id: number; nickname: string }[] | null;
      unavailable_voters: { id: number; nickname: string }[] | null;
    }>(
      `SELECT rd.id::text AS date_id,
              to_char(rd.the_date, 'YYYY-MM-DD') AS the_date,
              COUNT(a.participant_id) FILTER (WHERE a.status = 'yes')::text AS votes,
              COUNT(a.participant_id) FILTER (WHERE a.status = 'no')::text  AS no_votes,
              COALESCE(
                jsonb_agg(
                  jsonb_build_object('id', p.id, 'nickname', p.nickname)
                  ORDER BY p.created_at
                ) FILTER (WHERE p.id IS NOT NULL AND a.status = 'yes'),
                '[]'::jsonb
              ) AS voters,
              COALESCE(
                jsonb_agg(
                  jsonb_build_object('id', p.id, 'nickname', p.nickname)
                  ORDER BY p.created_at
                ) FILTER (WHERE p.id IS NOT NULL AND a.status = 'no'),
                '[]'::jsonb
              ) AS unavailable_voters
       FROM room_dates rd
       LEFT JOIN availabilities a ON a.room_date_id = rd.id
       LEFT JOIN participants   p ON p.id           = a.participant_id
       WHERE rd.room_id = $1
       GROUP BY rd.id, rd.the_date
       ORDER BY COUNT(a.participant_id) FILTER (WHERE a.status = 'yes') DESC,
                COUNT(a.participant_id) FILTER (WHERE a.status = 'no')  ASC,
                rd.the_date ASC`,
      [roomId],
    );
    return res.rows.map((r) => ({
      dateId: Number(r.date_id),
      date: r.the_date,
      votes: Number(r.votes),
      voters: r.voters ?? [],
      noVotes: Number(r.no_votes),
      unavailableVoters: r.unavailable_voters ?? [],
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
