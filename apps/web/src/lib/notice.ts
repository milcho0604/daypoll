import type { Notice } from '@whenever/shared';
import { api } from './api';

// 공개 — 게시된 최신 공지 1건 (없으면 null).
// 메인 페이지(server component)에서 호출해 팝업에 넘긴다. API 가 죽어도
// 홈이 깨지면 안 되므로 호출부에서 try/catch 로 감싼다.
//
// no-store: 게시/게시중단/오타수정이 즉시 반영되게 (캐시 지연 없음). 공지 쿼리는
// 부분 인덱스 한 방이라 홈 방문마다 호출해도 가볍다.
export async function getActiveNotice(): Promise<Notice | null> {
  const res = await api<{ notice: Notice | null }>('/notice', {
    cache: 'no-store',
  });
  return res.notice;
}

export type { Notice };
