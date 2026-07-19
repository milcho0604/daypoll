import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';
import type { Notice } from '@whenever/shared';
import { PG_POOL } from '../database/database.module';

interface NoticeRow {
  id: string;
  title: string;
  body: string;
  scheduled_at: Date | null;
  published: boolean;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function toNotice(r: NoticeRow): Notice {
  return {
    id: Number(r.id),
    title: r.title,
    body: r.body,
    scheduledAt: r.scheduled_at ? r.scheduled_at.toISOString() : null,
    published: r.published,
    publishedAt: r.published_at ? r.published_at.toISOString() : null,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

const COLS = `id::text, title, body, scheduled_at, published, published_at, created_at, updated_at`;

@Injectable()
export class NoticeService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  // 공개 — 게시된 것 중 가장 최근에 "게시된" 1건. 없으면 null.
  // published_at DESC (created_at 아님) — 오래된 초안을 지금 게시해도 노출되게.
  async getActive(): Promise<Notice | null> {
    const res = await this.pool.query<NoticeRow>(
      `SELECT ${COLS} FROM notices
        WHERE published
        ORDER BY published_at DESC NULLS LAST, id DESC
        LIMIT 1`,
    );
    return res.rowCount ? toNotice(res.rows[0]) : null;
  }

  // 어드민 — 최근 목록 (초안 포함).
  async list(limit = 20): Promise<Notice[]> {
    const res = await this.pool.query<NoticeRow>(
      `SELECT ${COLS} FROM notices ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    return res.rows.map(toNotice);
  }

  async get(id: number): Promise<Notice> {
    const res = await this.pool.query<NoticeRow>(
      `SELECT ${COLS} FROM notices WHERE id = $1`,
      [id],
    );
    if (!res.rowCount) throw new NotFoundException('notice not found');
    return toNotice(res.rows[0]);
  }

  async create(input: {
    title: string;
    body: string;
    scheduledAt?: string | null;
  }): Promise<Notice> {
    const res = await this.pool.query<NoticeRow>(
      `INSERT INTO notices (title, body, scheduled_at)
       VALUES ($1, $2, $3)
       RETURNING ${COLS}`,
      [input.title, input.body, input.scheduledAt ?? null],
    );
    return toNotice(res.rows[0]);
  }

  async update(
    id: number,
    input: { title: string; body: string; scheduledAt?: string | null },
  ): Promise<Notice> {
    const res = await this.pool.query<NoticeRow>(
      `UPDATE notices
          SET title = $2, body = $3, scheduled_at = $4, updated_at = now()
        WHERE id = $1
        RETURNING ${COLS}`,
      [id, input.title, input.body, input.scheduledAt ?? null],
    );
    if (!res.rowCount) throw new NotFoundException('notice not found');
    return toNotice(res.rows[0]);
  }

  // 게시/게시중단. 게시하면 published_at 을 now() 로 찍어 "가장 최근 게시본"이 되게 한다.
  // getActive 는 published_at DESC 라 새로 게시한 게 노출된다. (게시중단 시 published_at 은
  // 남겨두지만 published=false 라 조회에서 제외됨 → 다시 게시하면 시각만 갱신.)
  async setPublished(id: number, published: boolean): Promise<Notice> {
    const res = await this.pool.query<NoticeRow>(
      `UPDATE notices
          SET published = $2,
              published_at = CASE WHEN $2 THEN now() ELSE published_at END,
              updated_at = now()
        WHERE id = $1
        RETURNING ${COLS}`,
      [id, published],
    );
    if (!res.rowCount) throw new NotFoundException('notice not found');
    return toNotice(res.rows[0]);
  }

  async remove(id: number): Promise<void> {
    const res = await this.pool.query(`DELETE FROM notices WHERE id = $1`, [
      id,
    ]);
    if (!res.rowCount) throw new NotFoundException('notice not found');
  }

  // scheduledAt 이 있으면 유효한 ISO8601 인지 서비스 레벨에서도 한 번 더 방어.
  // (DTO 에서 이미 검증하지만, 잘못된 값이 DB 로 새는 걸 막는 안전망)
  static assertValidScheduledAt(v: string | null | undefined): void {
    if (v == null) return;
    if (Number.isNaN(new Date(v).getTime())) {
      throw new BadRequestException('scheduledAt must be a valid datetime');
    }
  }
}
