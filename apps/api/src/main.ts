import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { initSentry, Sentry } from './sentry';

// Nest 모든 미캐치 예외를 Sentry 로 전송.
// 4xx 클라이언트 에러는 정상 흐름이라 제외 — 5xx 와 unhandled 만.
initSentry();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  const config = app.get(ConfigService);

  // Cloudflare Tunnel(cloudflared) → 127.0.0.1:3001 경로에선 루프백 호출만 신뢰.
  // 이 설정이 있어야 express 의 req.ip 가 X-Forwarded-For 를 정확히 파싱한다.
  const expressInstance = app.getHttpAdapter().getInstance() as {
    set: (k: string, v: unknown) => void;
  };
  expressInstance.set('trust proxy', 'loopback');

  const corsOrigin =
    config.get<string>('CORS_ORIGIN') ?? 'http://localhost:3000';
  app.enableCors({
    origin: corsOrigin.split(',').map((s) => s.trim()),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 프로세스 차원 unhandled rejection / uncaught exception 도 Sentry 로.
  process.on('unhandledRejection', (reason) => {
    console.error('[unhandledRejection]', reason);
    Sentry.captureException(reason);
  });
  process.on('uncaughtException', (err) => {
    console.error('[uncaughtException]', err);
    Sentry.captureException(err);
  });

  const port = Number(config.get<string>('API_PORT') ?? 3001);
  await app.listen(port);

  console.log(`[api] listening on http://localhost:${port}`);
}
void bootstrap();
