import { NextResponse } from 'next/server';
import { apiBaseUrl } from '@/lib/api';

// 프론트엔드 헬스체크. 업타임 모니터(Uptime Robot 등)가 Vercel 프론트를 감시할 때 사용.
// 프론트 라이브니스(항상 ok) + 백엔드 /health 도달성을 함께 반환한다.
export const dynamic = 'force-dynamic';

export async function GET() {
  const ts = new Date().toISOString();

  // apiMs: 이 함수(리전 = region)에서 백엔드까지 왕복. 사용자 체감이 아니라
  // "Vercel → Cloudflare → 터널 → 맥미니" 경로가 지금 몇 ms 인지 보는 계기판.
  // 경로가 해외 POP 으로 돌면 여기서 바로 드러난다.
  let api: 'ok' | 'down' = 'down';
  let apiMs: number | null = null;
  const started = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(`${apiBaseUrl}/health`, {
      cache: 'no-store',
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    apiMs = Date.now() - started;
    api = res.ok ? 'ok' : 'down';
  } catch {
    api = 'down';
  }

  return NextResponse.json(
    { status: 'ok', api, apiMs, region: process.env.VERCEL_REGION ?? null, ts },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
