#!/usr/bin/env bash
# 통합 테스트 러너.
# 1) Postgres 띄움 (이미 떠있으면 skip)
# 2) 테스트 DB 마이그레이션
# 3) API e2e (jest + supertest)
# 4) shared 빌드 → API 빌드
# 5) Web unit
# 6) API 띄움 → Web smoke (next prod build + 페이지 응답 검증)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# 운영 API 가 같은 맥에서 :3001 로 떠 있을 수 있다 (맥미니). 테스트는 다른 포트를 쓰고,
# 그 포트가 이미 쓰이고 있으면 남의 프로세스를 죽이지 않고 멈춘다.
PG_CONTAINER="${PG_CONTAINER:-moilga-dev-postgres}"
PG_PASSWORD="${POSTGRES_PASSWORD:-whenever}"
TEST_API_PORT="${TEST_API_PORT:-3011}"
TEST_WEB_PORT="${TEST_WEB_PORT:-3100}"
DB_URL_DEV="${DB_URL_DEV:-postgres://whenever:$PG_PASSWORD@127.0.0.1:5433/whenever}"
DB_URL_TEST="${DB_URL_TEST:-postgres://whenever:$PG_PASSWORD@127.0.0.1:5433/whenever_test}"

for p in "$TEST_API_PORT" "$TEST_WEB_PORT"; do
  if lsof -ti ":$p" > /dev/null 2>&1; then
    echo "포트 $p 이(가) 이미 쓰이고 있어요. 다른 포트를 TEST_API_PORT / TEST_WEB_PORT 로 지정하세요." >&2
    exit 1
  fi
done

echo "=========================================="
echo "  whenever — 통합 테스트"
echo "=========================================="

# ---- Docker / Postgres ----
echo "[1/6] Postgres 준비"
if ! docker info > /dev/null 2>&1; then
  echo "Docker daemon 이 꺼져 있습니다. Docker Desktop을 켜주세요." >&2
  exit 1
fi
# 컨테이너 이름으로 본다 — 다른 폴더(워크트리)에서 띄운 같은 컨테이너도 인식
pg_health() { docker inspect -f '{{.State.Health.Status}}' "$PG_CONTAINER" 2>/dev/null || true; }
if [ -z "$(pg_health)" ]; then
  docker compose up -d postgres > /dev/null
elif [ "$(docker inspect -f '{{.State.Running}}' "$PG_CONTAINER")" != "true" ]; then
  docker start "$PG_CONTAINER" > /dev/null
fi
# healthcheck 대기
for i in $(seq 1 30); do
  if [ "$(pg_health)" = "healthy" ]; then
    echo "  postgres healthy"
    break
  fi
  sleep 1
done

# ---- 테스트 DB 보장 ----
echo "[2/6] 테스트 DB 보장"
docker exec "$PG_CONTAINER" psql -U whenever -d whenever -tc "SELECT 1 FROM pg_database WHERE datname='whenever_test'" | grep -q 1 \
  || docker exec "$PG_CONTAINER" psql -U whenever -d whenever -c "CREATE DATABASE whenever_test;" > /dev/null
DATABASE_URL="$DB_URL_TEST" node apps/api/scripts/migrate.mjs > /dev/null
echo "  whenever_test 마이그레이션 완료"

# ---- shared 빌드 ----
echo "[3/6] shared 패키지 빌드"
pnpm --filter @whenever/shared build > /dev/null
echo "  shared dist 생성"

# ---- API e2e ----
echo "[4/6] API e2e 테스트"
TEST_DATABASE_URL="$DB_URL_TEST" pnpm --filter @whenever/api test:e2e

# ---- Web unit ----
echo "[5/6] Web unit 테스트"
pnpm --filter @whenever/web test

# ---- Web smoke ----
echo "[6/6] Web smoke 테스트"
# API 띄움 (개발 DB로)
pnpm --filter @whenever/api build > /dev/null
( cd apps/api && DATABASE_URL="$DB_URL_DEV" API_PORT="$TEST_API_PORT" CORS_ORIGIN="http://localhost:$TEST_WEB_PORT" nohup node dist/main.js > /tmp/whenever-api.log 2>&1 & )

for i in $(seq 1 20); do
  curl -s "http://localhost:$TEST_API_PORT/health" > /dev/null 2>&1 && break || sleep 1
done

cleanup() {
  echo "[cleanup] killing services"
  # 위에서 비어 있는 걸 확인한 테스트 전용 포트만 정리한다
  lsof -ti ":$TEST_API_PORT" | xargs -r kill 2>/dev/null || true
  lsof -ti ":$TEST_WEB_PORT" | xargs -r kill 2>/dev/null || true
}
trap cleanup EXIT

NEXT_PUBLIC_API_BASE_URL="http://localhost:$TEST_API_PORT" \
WEB_SMOKE_PORT="$TEST_WEB_PORT" \
bash scripts/web-smoke.sh

echo ""
echo "=========================================="
echo "  ✓ 모든 테스트 통과"
echo "=========================================="
