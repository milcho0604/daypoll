// 무가입 식별 토큰을 브라우저 localStorage에 방별로 저장.
// 기획서 5장 — `room_<roomId>` 키, JSON { clientToken, creatorToken? }.

export interface RoomTokens {
  clientToken?: string;
  creatorToken?: string;
}

const keyFor = (roomId: string) => `room_${roomId}`;

export function readTokens(roomId: string): RoomTokens {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(keyFor(roomId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return {
      clientToken: typeof parsed?.clientToken === 'string' ? parsed.clientToken : undefined,
      creatorToken: typeof parsed?.creatorToken === 'string' ? parsed.creatorToken : undefined,
    };
  } catch {
    return {};
  }
}

export function writeTokens(roomId: string, patch: RoomTokens): RoomTokens {
  if (typeof window === 'undefined') return patch;
  const next = { ...readTokens(roomId), ...patch };
  window.localStorage.setItem(keyFor(roomId), JSON.stringify(next));
  return next;
}

export function clearTokens(roomId: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(keyFor(roomId));
}
