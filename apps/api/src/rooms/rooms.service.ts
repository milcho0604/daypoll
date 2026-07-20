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
  Voter,
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
      confirmed_date_id: string | null;
      confirmed_at: Date | null;
    }>(
      `SELECT id, title, deadline, created_at, created_by, region,
              confirmed_date_id::text, confirmed_at
       FROM rooms WHERE id = $1`,
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
    const declined = await this.getDeclined(roomId);

    const confirmedDateId =
      room.confirmed_date_id != null ? Number(room.confirmed_date_id) : null;
    const confirmedDate =
      confirmedDateId != null
        ? (datesRes.rows.find((r) => Number(r.id) === confirmedDateId)
            ?.the_date ?? null)
        : null;

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
      declined,
      confirmedDateId,
      confirmedDate,
      confirmedAt: room.confirmed_at ? room.confirmed_at.toISOString() : null,
    };
  }

  async getResults(roomId: string): Promise<{
    results: DateResult[];
    participantCount: number;
    deadline: string | null;
    region: RegionCode | null;
    declined: Voter[];
    confirmedDateId: number | null;
    confirmedDate: string | null;
    confirmedAt: string | null;
  }> {
    const roomRes = await this.pool.query<{
      deadline: Date | null;
      region: string | null;
      confirmed_date_id: string | null;
      confirmed_at: Date | null;
    }>(
      `SELECT deadline, region, confirmed_date_id::text, confirmed_at
       FROM rooms WHERE id = $1`,
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
    const declined = await this.getDeclined(roomId);
    const row = roomRes.rows[0];
    const confirmedDateId =
      row.confirmed_date_id != null ? Number(row.confirmed_date_id) : null;
    const confirmedDate =
      confirmedDateId != null
        ? (results.find((r) => r.dateId === confirmedDateId)?.date ?? null)
        : null;
    return {
      results,
      participantCount: Number(partCountRes.rows[0].c),
      deadline: row.deadline ? row.deadline.toISOString() : null,
      region: (row.region as RegionCode | null) ?? null,
      declined,
      confirmedDateId,
      confirmedDate,
      confirmedAt: row.confirmed_at ? row.confirmed_at.toISOString() : null,
    };
  }

  async buildWinnerIcs(roomId: string): Promise<string> {
    const detail = await this.getDetail(roomId);
    // 확정된 날이 있으면 그 날을, 없으면 1위(잠정)를 캘린더 이벤트로.
    const confirmed =
      detail.confirmedDateId != null
        ? detail.results.find((r) => r.dateId === detail.confirmedDateId)
        : null;
    const target = confirmed ?? detail.results[0];
    if (!target || (!confirmed && target.votes === 0)) {
      throw new NotFoundException('no winner yet');
    }
    const date = target.date.replace(/-/g, ''); // YYYYMMDD
    const endDate = nextDay(target.date).replace(/-/g, '');
    const now = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
    const summary = escapeIcsText(detail.title);
    const description = escapeIcsText(
      confirmed
        ? `모일까 확정 날짜. 방 ID ${detail.id}.`
        : `모일까 투표 1위 (${target.votes}표). 방 ID ${detail.id}.`,
    );

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//moilga//ko//',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:winner-${detail.id}-${target.dateId}@moilga`,
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

  // 모임 확정 — 방장이 후보 중 하나를 최종 날짜로 못박는다. 확정 즉시 방 채널로
  // 브로드캐스트(전원 배너) + 어드민 이벤트. 확정되면 투표/불참이 잠긴다.
  async confirmDate(
    roomId: string,
    creatorToken: string | undefined,
    dateId: number,
  ): Promise<{ confirmedDateId: number; confirmedDate: string }> {
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
    // dateId 가 이 방의 후보 날짜인지 검증 (다른 방/임의 id 차단).
    const dateRes = await this.pool.query<{ the_date: string }>(
      `SELECT to_char(the_date,'YYYY-MM-DD') AS the_date
       FROM room_dates WHERE id = $1 AND room_id = $2`,
      [dateId, roomId],
    );
    if (dateRes.rowCount === 0) {
      throw new BadRequestException('date is not a candidate of this room');
    }
    await this.pool.query(
      `UPDATE rooms SET confirmed_date_id = $1, confirmed_at = now() WHERE id = $2`,
      [dateId, roomId],
    );
    const confirmedDate = dateRes.rows[0].the_date;
    this.realtime.emitConfirmed(roomId, {
      confirmedDateId: dateId,
      confirmedDate,
    });
    this.realtime.emitAdminEvent('room_confirmed', {
      roomId,
      date: confirmedDate,
    });
    return { confirmedDateId: dateId, confirmedDate };
  }

  // 확정 해제 — 방장이 되돌린다. 투표가 다시 열린다.
  async unconfirm(
    roomId: string,
    creatorToken: string | undefined,
  ): Promise<{ confirmedDateId: null }> {
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
    await this.pool.query(
      `UPDATE rooms SET confirmed_date_id = NULL, confirmed_at = NULL WHERE id = $1`,
      [roomId],
    );
    this.realtime.emitConfirmed(roomId, {
      confirmedDateId: null,
      confirmedDate: null,
    });
    this.realtime.emitAdminEvent('room_unconfirmed', { roomId });
    return { confirmedDateId: null };
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
    // 날짜별 집계 — 누가 가능한지(닉네임 배열). 순위 = 가능 수 DESC → 날짜 ASC.
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

  // 이번 모임 불참자 (사람 단위). 결과 화면에 "불참: 민수" 로 보여준다.
  private async getDeclined(roomId: string): Promise<Voter[]> {
    const res = await this.pool.query<{ id: number; nickname: string }>(
      `SELECT id, nickname FROM participants
        WHERE room_id = $1 AND declined = true
        ORDER BY created_at ASC`,
      [roomId],
    );
    return res.rows.map((r) => ({ id: Number(r.id), nickname: r.nickname }));
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
