import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

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

  const port = Number(config.get<string>('API_PORT') ?? 3001);
  await app.listen(port);

  console.log(`[api] listening on http://localhost:${port}`);
}
void bootstrap();
