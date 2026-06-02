# syntax=docker/dockerfile:1
# 운영용 NestJS API 이미지. 빌드 컨텍스트는 모노레포 루트.
#   docker build -f apps/api/Dockerfile .

# ---------- builder ----------
FROM node:20-slim AS builder
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

# 워크스페이스 매니페스트만 먼저 복사 → 의존성 설치 레이어 캐시 최대화
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

# api와 그 의존성(@whenever/shared)만 설치 (web 제외)
RUN pnpm install --frozen-lockfile --filter @whenever/api...

# 소스 복사 후 shared → api 순서로 빌드
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @whenever/shared build \
 && pnpm --filter @whenever/api build

# ---------- runner ----------
FROM node:20-slim AS runner
ENV NODE_ENV=production
RUN corepack enable
WORKDIR /repo

# 빌드 산출물 + node_modules(pnpm isolated 심링크 구조 포함) 통째로 복사
COPY --from=builder /repo ./

WORKDIR /repo/apps/api
EXPOSE 3001

# 기동 시 마이그레이션 적용 후 서버 시작.
# migrate.mjs 는 _migrations 테이블로 이미 적용된 건 건너뛰므로 멱등.
CMD ["sh", "-c", "node scripts/migrate.mjs && node dist/main.js"]
