#!/usr/bin/env bash
# Next.js 프로덕션 빌드 + 실행 → 주요 페이지 응답을 grep으로 검증.
# 사전조건: API가 :3001 에서 떠 있어야 한다 (created/방 화면 SSR이 호출).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PORT=${WEB_SMOKE_PORT:-3100}
API_BASE="${NEXT_PUBLIC_API_BASE_URL:-http://localhost:3001}"

echo "[web-smoke] build..."
pnpm --filter @whenever/web build > /tmp/whenever-web-build.log 2>&1
echo "[web-smoke] build ok"

echo "[web-smoke] starting next start on :$PORT (api=$API_BASE)"
(cd apps/web && \
  NEXT_PUBLIC_API_BASE_URL="$API_BASE" \
  PORT="$PORT" \
  nohup pnpm exec next start -p "$PORT" > /tmp/whenever-web-start.log 2>&1 &)

cleanup() {
  echo "[web-smoke] cleanup"
  lsof -ti ":$PORT" | xargs -r kill 2>/dev/null || true
}
trap cleanup EXIT

# 부팅 대기
for i in $(seq 1 30); do
  if curl -s -o /dev/null -w '' "http://localhost:$PORT" 2>/dev/null; then
    echo "[web-smoke] ready (iter=$i)"
    break
  fi
  sleep 1
done

fail() { echo "[FAIL] $*"; exit 1; }
expect_in() {
  local url="$1" needle="$2"
  local body
  body=$(curl -s "$url")
  if ! echo "$body" | grep -q -- "$needle"; then
    echo "--- body ($url) ---"; echo "$body" | head -20
    fail "missing '$needle' at $url"
  fi
  echo "  ok: $url contains '$needle'"
}

echo "[web-smoke] checking pages..."
expect_in "http://localhost:$PORT/"             "언제모여"
expect_in "http://localhost:$PORT/"             "방 만들기"
expect_in "http://localhost:$PORT/rooms/new"    "후보 날짜"
expect_in "http://localhost:$PORT/rooms/new"    "마감일 설정"

# API를 거쳐 실제 방 하나 만들어서 그 페이지 검증
CREATE=$(curl -s -X POST "$API_BASE/rooms" \
  -H 'Content-Type: application/json' \
  -d '{"title":"smoke-test","dates":["2026-09-15","2026-09-16"]}')
ROOM_ID=$(echo "$CREATE" | python3 -c "import sys,json;print(json.load(sys.stdin)['roomId'])")
echo "[web-smoke] created room $ROOM_ID"

expect_in "http://localhost:$PORT/rooms/$ROOM_ID/created" "방 생성 완료"
expect_in "http://localhost:$PORT/rooms/$ROOM_ID/created" "링크만 복사"

expect_in "http://localhost:$PORT/rooms/$ROOM_ID" "smoke-test"
expect_in "http://localhost:$PORT/rooms/$ROOM_ID" "반가워요"
expect_in "http://localhost:$PORT/rooms/$ROOM_ID" "실시간 순위"

expect_in "http://localhost:$PORT/rooms/DOES_NOT_EXIST_ABC" "방을 찾을 수 없어요"

echo "[web-smoke] all checks passed"
