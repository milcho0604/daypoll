import { timingSafeEqual } from 'node:crypto';

// 토큰/시크릿 비교용 상수 시간 비교.
// === 직접 비교는 일치하는 접두사 길이에 따라 응답 시간이 달라져
// 타이밍 사이드채널이 생길 수 있다.
export function secureEquals(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
