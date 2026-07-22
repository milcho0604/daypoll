import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import type { VisitDetail, VisitStats } from '@whenever/shared';
import { PG_POOL } from '../database/database.module';

// 방문 경로 정규화 — 방 id 같은 가변 세그먼트를 묶어 distinct 경로가 무한히
// 늘지 않게 한다. (/rooms/abc123 → /rooms/[id], /rooms/new 는 유지)
// 인증 없는 비콘이 임의 경로를 꽂아 page_views 행을 무한 증식시키지 못하게,
// 최종적으로는 우리 라우트 화이트리스트 밖 경로를 전부 '/other' 로 뭉갠다.
const KNOWN_PATHS = new Set([
  '/',
  '/rooms/new',
  '/rooms/[id]',
  '/rooms/[id]/created',
  '/blog',
  '/privacy',
  '/terms',
]);

export function normalizePath(raw: string): string {
  let p = (raw || '/').split('?')[0].split('#')[0];
  if (!p.startsWith('/')) p = '/' + p;
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  // /rooms/<id>...  (단 /rooms/new 제외)
  p = p.replace(/^\/rooms\/(?!new(\/|$))[^/]+/, '/rooms/[id]');
  if (!p) return '/';
  if (KNOWN_PATHS.has(p)) return p;
  if (p.startsWith('/blog/')) return '/blog/[slug]';
  if (p === '/admin' || p.startsWith('/admin/')) return '/admin';
  return '/other';
}

// 명시적 utm_source/ref 로 인정하는 알려진 source 키 (그 외 임의 문자열은 무시).
const KNOWN_SOURCES = new Set([
  'naver',
  'google',
  'kakao',
  'instagram',
  'facebook',
  'daum',
  'youtube',
  'x',
  'bing',
]);

// utm_source/ref 힌트 → 알려진 source 키. 인증 없는 값이라 화이트리스트로만 인정.
// (임의 문자열이 그대로 집계에 들어가 카디널리티가 터지는 걸 막는다)
function normalizeRefHint(ref: string | undefined | null): string | null {
  const s = (ref || '').trim().toLowerCase();
  if (!s) return null;
  const alias: Record<string, string> = {
    twitter: 'x',
    fb: 'facebook',
    ig: 'instagram',
    yt: 'youtube',
  };
  const key = alias[s] ?? s;
  return KNOWN_SOURCES.has(key) ? key : null;
}

// referrer URL → coarse source 라벨. 원본 URL 은 저장하지 않고 이 라벨만 남긴다.
// 특수값: 'direct'(referrer 없음/파싱 불가), 'internal'(우리 도메인 — 집계 제외).
export function classifyReferrer(
  referrer: string | undefined | null,
  selfHosts: readonly string[] = [],
): string {
  const raw = (referrer || '').trim();
  if (!raw) return 'direct';
  let host: string;
  try {
    host = new URL(raw).hostname.toLowerCase();
  } catch {
    return 'direct'; // URL 로 파싱 안 되면 출처 불명 → direct 취급
  }
  if (!host) return 'direct';
  if (host.startsWith('www.')) host = host.slice(4);

  // 우리 도메인에서 온 내부 이동 — 외부 유입이 아니므로 집계에서 뺀다.
  // moilga.com 은 배포 환경과 무관하게 항상 우리 도메인(CORS_ORIGIN 누락 대비 하드코딩).
  const isSelf =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === 'moilga.com' ||
    host.endsWith('.moilga.com') ||
    host.endsWith('.vercel.app') ||
    selfHosts.some((h) => host === h || host.endsWith('.' + h));
  if (isSelf) return 'internal';

  // 검색엔진·SNS 매핑 (host 부분일치). 카카오톡 인앱 등 referrer 가 비면 direct 로 빠진다.
  if (host.includes('naver.')) return 'naver';
  if (host.includes('google.')) return 'google';
  if (host.includes('daum.')) return 'daum';
  if (host.includes('kakao')) return 'kakao'; // kakao.com · kakaocorp.com
  if (host.includes('instagram.')) return 'instagram';
  if (host === 'fb.com' || host === 'fb.me' || host.includes('facebook.'))
    return 'facebook';
  if (host.includes('youtube.') || host === 'youtu.be') return 'youtube';
  if (host === 'x.com' || host === 't.co' || host.includes('twitter.'))
    return 'x';
  if (host.includes('bing.')) return 'bing';

  // 그 외 외부 host — 그대로 저장하면 인증 없는 비콘으로 임의 host 를 무한히
  // 꽂아 visit_sources 카디널리티를 터뜨릴 수 있다. 'other' 하나로 뭉갠다.
  return 'other';
}

// referrer + 명시적 ref 힌트를 합쳐 최종 source 라벨을 정한다.
// ref(utm_source) 가 알려진 값이면 우선 — 카카오톡 공유처럼 referrer 가 빈 경우를 잡는다.
export function classifySource(
  referrer: string | undefined | null,
  ref: string | undefined | null,
  selfHosts: readonly string[] = [],
): string {
  const hinted = normalizeRefHint(ref);
  if (hinted) return hinted;
  return classifyReferrer(referrer, selfHosts);
}

@Injectable()
export class AnalyticsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  // 방문 1회 기록 (PII 없음 — KST 날짜 × 경로별 카운트만 누적).
  // referrer/ref 는 선택 — 서버가 coarse source 라벨로 분류해 visit_sources 에도 누적한다.
  // (원본 referrer URL 은 저장하지 않는다 — 쿼리스트링에 PII 가 섞일 수 있음)
  async recordVisit(
    path: string,
    referrer?: string | null,
    ref?: string | null,
  ): Promise<void> {
    const norm = normalizePath(path);
    await this.pool.query(
      `INSERT INTO page_views (day, path, count)
       VALUES ((now() AT TIME ZONE 'Asia/Seoul')::date, $1, 1)
       ON CONFLICT (day, path) DO UPDATE SET count = page_views.count + 1`,
      [norm],
    );

    const source = classifySource(referrer, ref, this.selfHosts());
    // internal(우리 도메인 내부 이동)은 유입 경로가 아니므로 집계하지 않는다.
    if (source === 'internal') return;
    await this.pool.query(
      `INSERT INTO visit_sources (day, source, count)
       VALUES ((now() AT TIME ZONE 'Asia/Seoul')::date, $1, 1)
       ON CONFLICT (day, source) DO UPDATE SET count = visit_sources.count + 1`,
      [source],
    );
  }

  // CORS_ORIGIN(허용된 웹 오리진 목록)에서 host 만 뽑아 내부 이동 판별에 쓴다.
  private selfHosts(): string[] {
    const hosts: string[] = [];
    for (const origin of (process.env.CORS_ORIGIN ?? '').split(',')) {
      const s = origin.trim();
      if (!s) continue;
      try {
        let h = new URL(s).hostname.toLowerCase();
        if (h.startsWith('www.')) h = h.slice(4);
        if (h) hosts.push(h);
      } catch {
        /* 무시 */
      }
    }
    return hosts;
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
    const [totals, daily, paths, sources] = await Promise.all([
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
         ORDER BY SUM(count) DESC, path ASC
         LIMIT 50`,
      ),
      // 유입 경로(source)별 창별 카운트 — page_views 표와 같은 FILTER 창 규칙(KST).
      this.pool.query<{
        source: string;
        today: string;
        last7: string;
        last30: string;
        all: string;
      }>(
        `SELECT source,
           COALESCE(SUM(count) FILTER (WHERE day = ${kstToday}), 0)::text        AS today,
           COALESCE(SUM(count) FILTER (WHERE day >= ${kstToday} - 6), 0)::text   AS last7,
           COALESCE(SUM(count) FILTER (WHERE day >= ${kstToday} - 29), 0)::text  AS last30,
           SUM(count)::text                                                      AS all
         FROM visit_sources
         GROUP BY source
         ORDER BY SUM(count) DESC, source ASC
         LIMIT 30`,
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
      sources: sources.rows.map((r) => ({
        source: r.source,
        today: Number(r.today),
        last7Days: Number(r.last7),
        last30Days: Number(r.last30),
        allTime: Number(r.all),
      })),
    };
  }
}
