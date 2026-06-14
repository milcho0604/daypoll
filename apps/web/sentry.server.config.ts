// 서버 (Node.js 런타임) 에서 도는 Sentry 초기화.
// SENTRY_DSN 환경변수가 없으면 instrumentation.ts 가 이 파일을 import 하지 않음.
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
  tracesSampleRate: 0,
  sendDefaultPii: false,
  beforeSend(event) {
    if (event.request) {
      delete event.request.headers;
      delete event.request.cookies;
      delete event.request.data;
    }
    return event;
  },
});
