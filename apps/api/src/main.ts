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
    use: (
      handler: (
        req: unknown,
        res: { setHeader: (k: string, v: string) => void },
        next: () => void,
      ) => void,
    ) => void;
  };
  expressInstance.set('trust proxy', 'loopback');

  // 모든 응답 no-store — 방/표/내 정보는 실시간 값이라 어떤 캐시에도 남으면 안 된다.
  // 웹 쪽 fetch 가 `cache: 'no-store'` 로 이걸 대신하고 있었는데, 그 옵션은
  // Chromium 에서 CORS preflight 캐시까지 무시하게 만들어 호출마다 OPTIONS 가
  // 붙었다. 캐시 금지는 서버 헤더로 옮기고 fetch 는 기본 캐시 모드를 쓴다.
  expressInstance.use(
    (
      _req: unknown,
      res: { setHeader: (k: string, v: string) => void },
      next: () => void,
    ) => {
      res.setHeader('Cache-Control', 'no-store');
      next();
    },
  );

  const corsOrigin =
    config.get<string>('CORS_ORIGIN') ?? 'http://localhost:3000';
  app.enableCors({
    origin: corsOrigin.split(',').map((s) => s.trim()),
    credentials: true,
    // preflight(OPTIONS) 결과를 브라우저가 10분 캐시. 없으면 Chrome 기본 5초라
    // x-client-token 이 붙는 호출(내 표·투표 저장)마다 OPTIONS 왕복이 반복됐다.
    // 해외 POP 을 도는 회선(HKG/LAX)에선 왕복 하나가 150~800ms 라 체감이 크다.
    maxAge: 600,
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
