// Next.js 16 가 모든 런타임 진입 직전에 부르는 후크.
// 여기서 Sentry 의 server / edge 초기화를 위임한다.
// 클라이언트(브라우저) 초기화는 별도 sentry.client.config.ts 가 자동 로드됨.

export async function register() {
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    // DSN 미설정이면 노출 안 함 (개발 / DSN 발급 전 단계)
    return;
  }
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

// 서버 라우트 / 미들웨어 에러 자동 캡쳐. Next 16 의 시그니처를 그대로 받아
// Sentry SDK 로 위임. (Sentry 의 RequestInfo 와 web standard Request 사이에
// 미세 type 차이가 있어 unknown 으로 우회.)
export const onRequestError: (
  err: unknown,
  request: Request,
  context: { routerKind: string; routePath: string; routeType: string },
) => Promise<void> = async (err, request, context) => {
  const { captureRequestError } = await import('@sentry/nextjs');
  return captureRequestError(
    err,
    request as unknown as Parameters<typeof captureRequestError>[1],
    context as unknown as Parameters<typeof captureRequestError>[2],
  );
};
