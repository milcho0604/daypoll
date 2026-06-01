#!/usr/bin/env bash
# 통합 테스트 러너.
# 1) Postgres 띄움 (이미 떠있으면 skip)
# 2) 테스트 DB 마이그레이션
# 3) API e2e (jest + supertest)
# 4) shared 빌드 → API 빌드
# 5) API 띄움 → Web smoke (next prod build + 페이지 응답 검증)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DB_URL_DEV="postgres://whenever:whenever@127.0.0.1:5433/whenever"
DB_URL_TEST="postgres://whenever:whenever@127.0.0.1:5433/whenever_test"

echo "=========================================="
echo "  whenever — 통합 테스트"
echo "=========================================="

# ---- Docker / Postgres ----
echo "[1/5] Postgres 준비"
if ! docker info > /dev/null 2>&1; then
  echo "Docker daemon 이 꺼져 있습니다. Docker Desktop을 켜주세요." >&2
  exit 1
fi
if ! docker compose ps postgres 2>/dev/null | grep -q "Up"; then
  docker compose up -d postgres > /dev/null
fi
# healthcheck 대기
for i in $(seq 1 30); do
  if docker compose ps postgres --format json 2>/dev/null | grep -q '"Health":"healthy"'; then
    echo "  postgres healthy"
    break
  fi
  sleep 1
done

# ---- 테스트 DB 보장 ----
echo "[2/5] 테스트 DB 보장"
docker exec whenever-postgres psql -U whenever -d whenever -tc "SELECT 1 FROM pg_database WHERE datname='whenever_test'" | grep -q 1 \
  || docker exec whenever-postgres psql -U whenever -d whenever -c "CREATE DATABASE whenever_test;" > /dev/null
DATABASE_URL="$DB_URL_TEST" node apps/api/scripts/migrate.mjs > /dev/null
echo "  whenever_test 마이그레이션 완료"

# ---- shared 빌드 ----
echo "[3/5] shared 패키지 빌드"
pnpm --filter @whenever/shared build > /dev/null
echo "  shared dist 생성"

# ---- API e2e ----
echo "[4/5] API e2e 테스트"
pnpm --filter @whenever/api test:e2e

# ---- Web smoke ----
echo "[5/5] Web smoke 테스트"
# API 띄움 (개발 DB로)
lsof -ti :3001 | xargs -r kill 2>/dev/null || true
pnpm --filter @whenever/api build > /dev/null
( cd apps/api && DATABASE_URL="$DB_URL_DEV" CORS_ORIGIN="http://localhost:3100" nohup node dist/main.js > /tmp/whenever-api.log 2>&1 & )

for i in $(seq 1 20); do
  curl -s "http://localhost:3001/health" > /dev/null 2>&1 && break || sleep 1
done

cleanup() {
  echo "[cleanup] killing services"
  lsof -ti :3001 | xargs -r kill 2>/dev/null || true
  lsof -ti :3100 | xargs -r kill 2>/dev/null || true
}
trap cleanup EXIT

NEXT_PUBLIC_API_BASE_URL="http://localhost:3001" \
WEB_SMOKE_PORT=3100 \
bash scripts/web-smoke.sh

echo ""
echo "=========================================="
echo "  ✓ 모든 테스트 통과"
echo "=========================================="
