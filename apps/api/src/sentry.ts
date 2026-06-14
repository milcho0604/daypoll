import * as Sentry from '@sentry/node';

// SENTRY_DSN 환경변수가 있을 때만 활성화. 없으면 no-op (개발/로컬 + DSN 미발급 단계).
// Sentry SaaS free tier — 5K events/월. https://sentry.io
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.log('[sentry] SENTRY_DSN 미설정 — 에러 추적 비활성');
    return;
  }
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'production',
    // 친구 모임 트래픽 기준 — 전체 캡쳐.
    tracesSampleRate: 0,
    // 닉네임 / PIN / 토큰 같은 민감값이 에러 컨텍스트에 끼는 걸 차단.
    sendDefaultPii: false,
    beforeSend(event) {
      // headers / cookies 같은 잠재 민감 정보 제거.
      if (event.request) {
        delete event.request.headers;
        delete event.request.cookies;
        delete event.request.data;
      }
      return event;
    },
  });
  console.log('[sentry] 에러 추적 활성');
}

export { Sentry };
