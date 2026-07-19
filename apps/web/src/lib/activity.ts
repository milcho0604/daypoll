// 활동 피드 표시 헬퍼 — 대시보드 카드와 /admin/activity 페이지가 공유한다.
// 소켓 실시간 이벤트(admin:event)와 히스토리 API(ActivityEvent)는 필드가 조금
// 다르지만(예: room_created 의 title vs roomTitle), 여기서 한 벌로 흡수한다.
import type { ActivityEvent } from '@whenever/shared';

export interface FeedRow {
  id: string;
  ts: string;
  type: string;
  text: string;
  roomId?: string;
}

// 타입별 아이콘(단색 이모지 — 앱 UI 밖 텍스트 장식이라 §1 예외).
export function activityEmoji(type: string): string {
  switch (type) {
    case 'room_created':
      return '🆕';
    case 'joined':
    case 'participant_joined':
      return '👤';
    case 'voted':
      return '🗳️';
    case 'declined':
      return '🙅';
    case 'undeclined':
      return '↩️';
    case 'deadline_updated':
      return '⏰';
    case 'room_deleted':
      return '🗑️';
    case 'participant_kicked':
      return '🚫';
    default:
      return '•';
  }
}

// 사람이 읽는 한 줄 텍스트. 방 이름이 있으면 곁들인다.
export function activityText(e: {
  type: string;
  nickname?: string | null;
  count?: number | null;
  roomTitle?: string | null;
  title?: string | null;
  roomId?: string | null;
}): string {
  const who = e.nickname ?? '누군가';
  const room = e.roomTitle ?? e.title ?? e.roomId ?? '';
  const at = room ? ` · '${room}'` : '';
  switch (e.type) {
    case 'room_created':
      return `새 방 "${e.title ?? e.roomTitle ?? e.roomId ?? ''}" 개설`;
    case 'joined':
    case 'participant_joined':
      return `${who} 입장${at}`;
    case 'voted':
      return `${who} 투표${e.count ? ` (${e.count}일)` : ''}${at}`;
    case 'declined':
      return `${who} 불참${at}`;
    case 'undeclined':
      return `${who} 참여로 전환${at}`;
    case 'deadline_updated':
      return `마감 변경${at}`;
    case 'room_deleted':
      return `방 삭제${e.roomId ? ` (${e.roomId})` : ''}`;
    case 'participant_kicked':
      return `${who} 강퇴${at}`;
    default:
      return e.type;
  }
}

// 히스토리 API 이벤트 → FeedRow
export function historyToRow(e: ActivityEvent, idx: number): FeedRow {
  return {
    id: `h-${e.ts}-${e.type}-${e.nickname ?? ''}-${idx}`,
    ts: e.ts,
    type: e.type,
    text: activityText(e),
    roomId: e.roomId,
  };
}

// 소켓 실시간 이벤트 → FeedRow (ts 는 서버가 붙여 보냄)
export function socketToRow(e: {
  type: string;
  ts: string;
  [k: string]: unknown;
}): FeedRow {
  return {
    id: `s-${e.ts}-${Math.random().toString(36).slice(2, 8)}`,
    ts: e.ts,
    type: e.type,
    text: activityText(e as Parameters<typeof activityText>[0]),
    roomId: typeof e.roomId === 'string' ? e.roomId : undefined,
  };
}

// 상대 시각 ("방금", "3분 전"). 대시보드와 동일 규칙.
export function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  if (diff < 60_000) return '방금';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return `${Math.floor(diff / 86_400_000)}일 전`;
}

// 절대 시각 (KST, "07-19 23:14")
export function formatAbsolute(iso: string): string {
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 3_600_000);
  const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(kst.getUTCDate()).padStart(2, '0');
  const hh = String(kst.getUTCHours()).padStart(2, '0');
  const mi = String(kst.getUTCMinutes()).padStart(2, '0');
  return `${mm}-${dd} ${hh}:${mi}`;
}
