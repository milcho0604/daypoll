import type { Notice } from '@whenever/shared';
import { api } from './api';

// 공개 — 게시된 최신 공지 1건 (없으면 null).
// 메인 페이지(server component)에서 호출해 팝업에 넘긴다. API 가 죽어도
// 홈이 깨지면 안 되므로 호출부에서 try/catch 로 감싼다.
//
// 60초 ISR: 예전엔 no-store 라 홈이 매 요청 SSR 이었고, Vercel 함수(iad1) →
// Cloudflare → 터널 → 맥미니 왕복 때문에 홈 TTFB 가 0.5~1.0초였다 (실측).
// 60초 캐시면 홈이 엣지 HIT(≈80ms) 로 나가고, 공지 게시/중단은 최대 1분 뒤 반영.
// 공지는 그 정도 지연이 문제되는 정보가 아니다.
export const NOTICE_REVALIDATE_SECONDS = 60;

export async function getActiveNotice(): Promise<Notice | null> {
  const res = await api<{ notice: Notice | null }>('/notice', {
    revalidate: NOTICE_REVALIDATE_SECONDS,
  });
  return res.notice;
}

export type { Notice };
