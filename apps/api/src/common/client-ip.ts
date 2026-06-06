import type { Request } from 'express';

// 운영에선 Cloudflare Tunnel → cloudflared(호스트) → API(127.0.0.1) 경로다.
// 이 경우 req.ip 는 항상 루프백이 되므로 레이트리밋 키가 1개로 묶여 무력화된다.
// CF가 붙여주는 cf-connecting-ip 를 1순위로 사용하고,
// 없으면 (개발/직접 노출 환경) trust proxy 가 켜진 express 의 req.ip 를 쓴다.
// XFF 같은 중간 헤더는 cloudflared 가 항상 채워주지만 cf-connecting-ip 가 더 정확.
export function clientIp(req: Request): string {
  const cf = req.header('cf-connecting-ip');
  if (typeof cf === 'string' && cf.length > 0) {
    return cf.split(',')[0].trim();
  }
  return req.ip || 'unknown';
}
