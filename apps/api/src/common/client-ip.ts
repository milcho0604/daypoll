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
    return rateKeyIp(cf.split(',')[0].trim());
  }
  return rateKeyIp(req.ip || 'unknown');
}

// 레이트리밋·잠금 키용 IP. IPv6 는 가입자 한 명이 /64 대역을 통째로 받으므로
// 주소를 그대로 쓰면 대역 안에서 주소만 바꿔 한도를 무한히 피한다 → /64 로 묶는다.
// IPv4(및 ::ffff:1.2.3.4 매핑)는 그대로.
export function rateKeyIp(ip: string): string {
  if (!ip.includes(':')) return ip;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return mapped[1];
  const addr = ip.split('%')[0].toLowerCase(); // zone id 제거
  const [head, tail] = addr.split('::');
  const h = head ? head.split(':') : [];
  const t = tail !== undefined && tail ? tail.split(':') : [];
  const groups =
    tail === undefined
      ? h
      : [
          ...h,
          ...Array<string>(Math.max(0, 8 - h.length - t.length)).fill('0'),
          ...t,
        ];
  if (groups.length < 4) return addr;
  return `${groups
    .slice(0, 4)
    .map((g) => g.replace(/^0+(?=.)/, '') || '0')
    .join(':')}::/64`;
}
