import type { Request } from 'express';

// 운영 경로: 친구 브라우저 → Cloudflare Edge → cloudflared(맥미니 호스트)
//             → API(127.0.0.1:3001 Docker bridge).
// 이 경우 req.ip 는 항상 루프백/브리지가 되어 레이트리밋 키가 1개로 묶여 무력화된다.
// Cloudflare 가 붙여주는 cf-connecting-ip 를 1순위로 사용한다 — 이 값이 실제 클라이언트 IP.
// 없으면 (개발 / 직접 노출 환경) trust proxy 가 켜진 express 의 req.ip 를 fallback.
// X-Forwarded-For 는 신뢰 X — Tailscale Funnel 시절 중간 노드가 자기 IP 를 넣어 신뢰 못함.
// 그래서 cf-connecting-ip 한 군데만 본다.
export function clientIp(req: Request): string {
  const cf = req.header('cf-connecting-ip');
  if (typeof cf === 'string' && cf.length > 0) {
    return cf.split(',')[0].trim();
  }
  return req.ip || 'unknown';
}
