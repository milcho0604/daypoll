import { routes, type VercelConfig } from '@vercel/config/v1';

// vercel.json 을 프로그래밍 설정으로 옮김 (둘은 공존 불가 — 문서: "migrate by copying").
//
// [실험] Vercel 경유 API 프록시가 성립하는지 프리뷰에서 실측하기 위한 프로브:
//  - /_probe/trace   → Cloudflare 가 보는 Vercel 의 송신 IP 와 POP(colo). 서울이면 프록시 경로가 짧다.
//  - /_probe/headers → 상류가 받는 헤더 원본. Vercel 이 클라이언트 IP 를 어떤 헤더로 넘기는지,
//                       requestHeaders 로 심은 값이 실제로 붙는지.
//  - /_probe/health  → Vercel 엣지 → API 왕복 시간.
// 실측 후 프로브는 제거한다.
//
// @vercel/config 0.7: routes.rewrite() 는 객체만 돌려주고 등록하지 않는다. transforms 가 붙는
// rewrite 는 `rewrites` 가 아니라 `routes` 로 내려가야 하므로 route() 로 등록하고 getConfig() 로 변환.
// route() 의 src 는 정규식 — 프로브 경로만 정확히 잠근다.
routes.route({ src: '^/_probe/trace$', dest: 'https://api.moilga.com/cdn-cgi/trace' });
routes.route({ src: '^/_probe/health$', dest: 'https://api.moilga.com/health' });
routes.route(
  routes.rewrite('/_probe/headers', 'https://httpbin.org/headers', {
    requestHeaders: { 'x-proxy-probe': 'set-by-vercel-rewrite' },
  }),
);

export const config: VercelConfig = {
  regions: ['icn1'],
  ...routes.getConfig(),
};
