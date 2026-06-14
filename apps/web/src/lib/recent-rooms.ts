// '내 방' 목록 — 무가입 식별. 방문/생성한 방의 메타를 localStorage 에 인덱싱한다.
// 토큰(room_<id>)과 별개로 제목까지 보관해 홈에서 fetch 없이 목록을 그린다.
// 한계: 브라우저 앱별 저장이라 다른 브라우저/기기에선 안 보인다 (cross-device 는 로그인 영역).

import { readTokens } from './tokens';

const KEY = 'whenever_rooms';
const MAX = 30;

export interface RecentRoom {
  id: string;
  title: string;
  savedAt: number;
}

export function listRooms(): RecentRoom[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (r): r is RecentRoom =>
          r && typeof r.id === 'string' && typeof r.title === 'string',
      )
      .sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0));
  } catch {
    return [];
  }
}

// 생성/입장/재방문 시 호출 — 같은 방은 최신 제목 + 시각으로 갱신(맨 위로).
export function recordRoom(id: string, title: string) {
  if (typeof window === 'undefined') return;
  try {
    const next = [
      { id, title, savedAt: Date.now() },
      ...listRooms().filter((r) => r.id !== id),
    ].slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* 저장 실패(용량/프라이빗 모드)는 조용히 무시 — 목록은 부가 기능 */
  }
}

// 목록에서만 제거 — 토큰(room_<id>)은 남겨 링크 재방문 시 자동 복원되게(비파괴).
export function forgetRoom(id: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify(listRooms().filter((r) => r.id !== id)),
    );
  } catch {
    /* ignore */
  }
}

// 방 만든 사람인지(관리 권한 보유) — 뱃지 표시용. 라이브로 토큰 확인해 항상 정확.
export function isCreator(id: string): boolean {
  return !!readTokens(id).creatorToken;
}
