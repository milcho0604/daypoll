// 브라우저에서 도는 Sentry 초기화.
// NEXT_PUBLIC_SENTRY_DSN 이 빌드 타임에 박혀야 클라이언트에서 동작.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'production',
    // 친구 모임 트래픽 — 전체 캡쳐, 샘플링 없음.
    tracesSampleRate: 0,
    // 닉네임 / IP 같은 PII 자동 수집 끔.
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request) {
        delete event.request.headers;
        delete event.request.cookies;
      }
      return event;
    },
  });
}
