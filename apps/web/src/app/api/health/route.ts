import { NextResponse } from 'next/server';
import { apiBaseUrl } from '@/lib/api';

// 프론트엔드 헬스체크. 업타임 모니터(Uptime Robot 등)가 Vercel 프론트를 감시할 때 사용.
// 프론트 라이브니스(항상 ok) + 백엔드 /health 도달성을 함께 반환한다.
export const dynamic = 'force-dynamic';

export async function GET() {
  const ts = new Date().toISOString();

  let api: 'ok' | 'down' = 'down';
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(`${apiBaseUrl}/health`, {
      cache: 'no-store',
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    api = res.ok ? 'ok' : 'down';
  } catch {
    api = 'down';
  }

  return NextResponse.json(
    { status: 'ok', api, ts },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
