import { randomBytes } from 'node:crypto';

const ROOM_ALPHABET =
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

// 방 링크용 12자. URL-safe + 추측 어렵게.
export function newRoomId(): string {
  const bytes = randomBytes(12);
  let out = '';
  for (let i = 0; i < 12; i++) {
    out += ROOM_ALPHABET[bytes[i] % ROOM_ALPHABET.length];
  }
  return out;
}

// 클라이언트/개설자 식별 토큰 32자 (URL-safe base64).
export function newToken(): string {
  return randomBytes(24).toString('base64url').slice(0, 32);
}
