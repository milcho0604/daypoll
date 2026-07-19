import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import type { VisitDetail, VisitStats } from '@whenever/shared';
import { PG_POOL } from '../database/database.module';

// 방문 경로 정규화 — 방 id 같은 가변 세그먼트를 묶어 distinct 경로가 무한히
// 늘지 않게 한다. (/rooms/abc123 → /rooms/[id], /rooms/new 는 유지)
export function normalizePath(raw: string): string {
  let p = (raw || '/').split('?')[0].split('#')[0];
  if (!p.startsWith('/')) p = '/' + p;
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  // /rooms/<id>...  (단 /rooms/new 제외)
  p = p.replace(/^\/rooms\/(?!new(\/|$))[^/]+/, '/rooms/[id]');
  if (p.length > 80) p = p.slice(0, 80);
  return p || '/';
}

@Injectable()
export class AnalyticsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  // 방문 1회 기록 (PII 없음 — KST 날짜 × 경로별 카운트만 누적).
  async recordVisit(path: string): Promise<void> {
    const norm = normalizePath(path);
    await this.pool.query(
      `INSERT INTO page_views (day, path, count)
       VALUES ((now() AT TIME ZONE 'Asia/Seoul')::date, $1, 1)
       ON CONFLICT (day, path) DO UPDATE SET count = page_views.count + 1`,
      [norm],
    );
  }

  async getStats(): Promise<VisitStats> {
    const [today, last7, daily, topPaths] = await Promise.all([
      this.pool.query<{ n: string }>(
        `SELECT COALESCE(SUM(count),0)::text AS n FROM page_views
          WHERE day = (now() AT TIME ZONE 'Asia/Seoul')::date`,
      ),
      this.pool.query<{ n: string }>(
        `SELECT COALESCE(SUM(count),0)::text AS n FROM page_views
          WHERE day >= (now() AT TIME ZONE 'Asia/Seoul')::date - 6`,
      ),
      this.pool.query<{ day: string; n: string }>(
        `SELECT to_char(day,'YYYY-MM-DD') AS day, SUM(count)::text AS n
           FROM page_views
          WHERE day >= (now() AT TIME ZONE 'Asia/Seoul')::date - 29
          GROUP BY day ORDER BY day ASC`,
      ),
      this.pool.query<{ path: string; n: string }>(
        `SELECT path, SUM(count)::text AS n FROM page_views
          WHERE day >= (now() AT TIME ZONE 'Asia/Seoul')::date - 6
          GROUP BY path ORDER BY SUM(count) DESC LIMIT 8`,
      ),
    ]);
    return {
      today: Number(today.rows[0].n),
      last7Days: Number(last7.rows[0].n),
      daily: daily.rows.map((r) => ({ day: r.day, count: Number(r.n) })),
      topPaths: topPaths.rows.map((r) => ({
        path: r.path,
        count: Number(r.n),
      })),
    };
  }

  // 방문 상세 페이지용 — 요약(getStats)보다 넓게. 전체 경로 × 창별 카운트 +
  // 90일 추이 + 전체 누적. 모든 창 경계는 KST(Asia/Seoul) 달력 날짜 기준.
  async getVisitsDetail(): Promise<VisitDetail> {
    const kstToday = `(now() AT TIME ZONE 'Asia/Seoul')::date`;
    const [totals, daily, paths] = await Promise.all([
      this.pool.query<{
        today: string;
        last7: string;
        last30: string;
        all: string;
        distinct: string;
      }>(
        `SELECT
           COALESCE(SUM(count) FILTER (WHERE day = ${kstToday}), 0)::text        AS today,
           COALESCE(SUM(count) FILTER (WHERE day >= ${kstToday} - 6), 0)::text   AS last7,
           COALESCE(SUM(count) FILTER (WHERE day >= ${kstToday} - 29), 0)::text  AS last30,
           COALESCE(SUM(count), 0)::text                                         AS all,
           COUNT(DISTINCT path)::text                                            AS distinct
         FROM page_views`,
      ),
      this.pool.query<{ day: string; n: string }>(
        `SELECT to_char(day,'YYYY-MM-DD') AS day, SUM(count)::text AS n
           FROM page_views
          WHERE day >= ${kstToday} - 89
          GROUP BY day ORDER BY day ASC`,
      ),
      this.pool.query<{
        path: string;
        today: string;
        last7: string;
        last30: string;
        all: string;
      }>(
        `SELECT path,
           COALESCE(SUM(count) FILTER (WHERE day = ${kstToday}), 0)::text        AS today,
           COALESCE(SUM(count) FILTER (WHERE day >= ${kstToday} - 6), 0)::text   AS last7,
           COALESCE(SUM(count) FILTER (WHERE day >= ${kstToday} - 29), 0)::text  AS last30,
           SUM(count)::text                                                      AS all
         FROM page_views
         GROUP BY path
         ORDER BY SUM(count) DESC, path ASC`,
      ),
    ]);
    const t = totals.rows[0];
    return {
      today: Number(t.today),
      last7Days: Number(t.last7),
      last30Days: Number(t.last30),
      allTime: Number(t.all),
      distinctPaths: Number(t.distinct),
      daily: daily.rows.map((r) => ({ day: r.day, count: Number(r.n) })),
      paths: paths.rows.map((r) => ({
        path: r.path,
        today: Number(r.today),
        last7Days: Number(r.last7),
        last30Days: Number(r.last30),
        allTime: Number(r.all),
      })),
    };
  }
}
