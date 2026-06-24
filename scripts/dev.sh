#!/usr/bin/env bash
#
# 모일까(moilga) 로컬 개발 스택 제어 스크립트
#
#   로컬 dev DB(Postgres/docker) · 로컬 API(NestJS) · 로컬 Web(Next.js) 를 한 번에 제어.
#
# 이 스크립트는 **로컬 개발 전용**이다. 같은 머신에서 도는 운영 스택
# (docker compose 프로젝트 'moilga', docker-compose.prod.yml)과 절대 충돌하지 않게
# 프로젝트명·포트를 전부 분리한다:
#
#                 운영(prod, 안 건드림)        로컬 dev(이 스크립트)
#   DB            moilga-postgres (내부망)     moilga-dev-postgres  :5433
#   API           moilga-api      :3001        pnpm dev:api         :3011
#   Web           Vercel (원격)                pnpm dev:web         :3000
#
# 사용법:
#   scripts/dev.sh start   [all|db|api|web]   # 시작 (기본 all)
#   scripts/dev.sh stop    [all|db|api|web]   # 중지 (기본 all)
#   scripts/dev.sh restart [all|db|api|web]   # 재시작 (기본 all)
#   scripts/dev.sh status                     # 로컬 dev + 운영 스택 상태
#   scripts/dev.sh logs    [api|web|db]       # 로그 follow (기본 api)

set -euo pipefail

# ── 경로 (스크립트 위치 기준으로 repo 루트 계산) ───────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$ROOT_DIR/logs"
mkdir -p "$LOG_DIR"

API_PID="$LOG_DIR/api.pid"
WEB_PID="$LOG_DIR/web.pid"
API_LOG="$LOG_DIR/api.log"
WEB_LOG="$LOG_DIR/web.log"

# ── 식별자/포트 (운영과 분리) ──────────────────────────────────────────────
DEV_PROJECT="moilga-dev"        # dev DB docker compose 프로젝트명 (운영=moilga 와 분리)
PROD_PROJECT="moilga"           # 운영 스택 프로젝트명 (status 표시용, 제어는 안 함)
DEV_DB_PORT=5433                # dev DB 호스트 포트 (.env DATABASE_URL 과 일치)
DEV_API_PORT=3011               # 로컬 API 포트 (운영 api :3001 과 분리)
DEV_WEB_PORT=3000               # 로컬 Web 포트 (운영 web 은 Vercel 이라 비어 있음)
DEV_API_BASE="http://localhost:$DEV_API_PORT"

# ── 색/출력 ────────────────────────────────────────────────────────────────
if [ -t 1 ]; then
  C_OK=$'\033[32m'; C_WARN=$'\033[33m'; C_ERR=$'\033[31m'; C_DIM=$'\033[2m'; C_RST=$'\033[0m'
else
  C_OK=''; C_WARN=''; C_ERR=''; C_DIM=''; C_RST=''
fi
say()  { printf '%s▸%s %s\n' "$C_DIM" "$C_RST" "$*"; }
ok()   { printf '%s✓%s %s\n' "$C_OK" "$C_RST" "$*"; }
warn() { printf '%s!%s %s\n' "$C_WARN" "$C_RST" "$*"; }
err()  { printf '%s✗%s %s\n' "$C_ERR" "$C_RST" "$*" >&2; }

# ── PID 헬퍼 ───────────────────────────────────────────────────────────────
# PID 파일이 가리키는 프로세스가 실제 살아있으면 PID 출력, 아니면 빈 문자열.
pid_alive() {
  local f="$1"
  [ -f "$f" ] || return 0
  local p; p="$(cat "$f" 2>/dev/null || true)"
  if [ -n "$p" ] && kill -0 "$p" 2>/dev/null; then
    echo "$p"
  fi
}

# ── dev DB (docker compose, 운영과 분리된 프로젝트) ────────────────────────
# 항상 -p moilga-dev + 명시적 dev compose 파일. 실행 경로(워크트리 등)와
# 무관하게 같은 dev 컨테이너만 다루고, 운영 스택(moilga)은 절대 안 건드린다.
db_compose() { (cd "$ROOT_DIR" && docker compose -p "$DEV_PROJECT" -f docker-compose.yml "$@"); }

db_running() {
  db_compose ps --status running --services 2>/dev/null | grep -q '^postgres$'
}

start_db() {
  if db_running; then ok "dev DB 이미 떠 있음 (moilga-dev-postgres :$DEV_DB_PORT)"; return; fi
  say "dev DB 시작 (docker compose up -d) …"
  db_compose up -d
  say "postgres healthy 대기 중 …"
  for _ in $(seq 1 30); do
    if db_compose ps 2>/dev/null | grep -q 'healthy'; then ok "dev DB healthy (:$DEV_DB_PORT)"; return; fi
    sleep 1
  done
  warn "dev DB 가 떴지만 healthcheck 확인 못 함 — 'scripts/dev.sh logs db' 로 확인"
}

stop_db() {
  if ! db_running; then warn "dev DB 안 떠 있음"; return; fi
  say "dev DB 중지 (docker compose stop) …"
  db_compose stop postgres >/dev/null
  ok "dev DB 중지됨 (데이터는 dev 볼륨에 보존)"
}

# ── 백그라운드 dev 프로세스 공통 ───────────────────────────────────────────
# nohup 으로 띄우고 PID 파일에 기록. macOS 엔 setsid 가 없어 프로세스그룹
# 종료가 안 되므로, 중지 시엔 후손 트리(pgrep -P)를 직접 훑어서 죽인다.
spawn() {
  local name="$1" pidfile="$2" logfile="$3"; shift 3
  : > "$logfile"
  nohup "$@" >>"$logfile" 2>&1 &
  echo $! > "$pidfile"
}

# 주어진 pid 의 모든 후손 pid 를 (자식→손자 순) 재귀로 수집.
descendants() {
  local parent="$1" child
  for child in $(pgrep -P "$parent" 2>/dev/null); do
    descendants "$child"
    echo "$child"
  done
}

# PID 파일이 가리키는 프로세스를 후손까지 전부 종료 (leaf 부터 TERM).
kill_tree() {
  local pidfile="$1" name="$2"
  local p; p="$(pid_alive "$pidfile")"
  if [ -z "$p" ]; then warn "$name 안 떠 있음"; rm -f "$pidfile"; return; fi
  say "$name 중지 (pid $p) …"
  local pids; pids="$(descendants "$p") $p"
  kill -TERM $pids 2>/dev/null || true
  for _ in $(seq 1 20); do
    kill -0 "$p" 2>/dev/null || break
    sleep 0.25
  done
  if kill -0 "$p" 2>/dev/null; then
    warn "$name 응답 없음 → KILL"
    pids="$(descendants "$p") $p"
    kill -KILL $pids 2>/dev/null || true
  fi
  rm -f "$pidfile"
  ok "$name 중지됨"
}

# ── 포트 점유 확인 ────────────────────────────────────────────────────────
port_holder() { lsof -nP -iTCP:"$1" -sTCP:LISTEN 2>/dev/null | awk 'NR==2{print $1" (pid "$2")"}'; }

# ── API (로컬 dev, :3011) ──────────────────────────────────────────────────
start_api() {
  local p; p="$(pid_alive "$API_PID")"
  if [ -n "$p" ]; then ok "API 이미 실행 중 (pid $p, :$DEV_API_PORT)"; return; fi
  local holder; holder="$(port_holder "$DEV_API_PORT")"
  if [ -n "$holder" ]; then err "포트 :$DEV_API_PORT 점유 중 → $holder. 정리 후 재시도"; return; fi
  if ! db_running; then warn "dev DB 가 안 떠 있음 — 'start db' 먼저 권장"; fi
  say "API 시작 (pnpm dev:api → :$DEV_API_PORT) …"
  # 운영 .env(API_PORT=3001) 를 덮어써 dev 포트로 띄운다.
  spawn "API" "$API_PID" "$API_LOG" env API_PORT="$DEV_API_PORT" pnpm --dir "$ROOT_DIR" dev:api
  sleep 1
  local np; np="$(pid_alive "$API_PID")"
  if [ -n "$np" ]; then ok "API 기동 (pid $np) — 로그: scripts/dev.sh logs api"; else rm -f "$API_PID"; err "API 기동 실패 — $API_LOG 확인"; fi
}
stop_api() { kill_tree "$API_PID" "API"; }

# ── Web (로컬 dev, :3000 → 로컬 API:3011) ──────────────────────────────────
start_web() {
  local p; p="$(pid_alive "$WEB_PID")"
  if [ -n "$p" ]; then ok "Web 이미 실행 중 (pid $p, :$DEV_WEB_PORT)"; return; fi
  local holder; holder="$(port_holder "$DEV_WEB_PORT")"
  if [ -n "$holder" ]; then err "포트 :$DEV_WEB_PORT 점유 중 → $holder. 정리 후 재시도"; return; fi
  say "Web 시작 (pnpm dev:web → :$DEV_WEB_PORT, API=$DEV_API_BASE) …"
  # 로컬 Web 은 로컬 API(:3011) 를 보게 한다 (운영 :3001 아님).
  spawn "Web" "$WEB_PID" "$WEB_LOG" env NEXT_PUBLIC_API_BASE_URL="$DEV_API_BASE" pnpm --dir "$ROOT_DIR" dev:web
  sleep 1
  local np; np="$(pid_alive "$WEB_PID")"
  if [ -n "$np" ]; then ok "Web 기동 (pid $np) — http://localhost:$DEV_WEB_PORT"; else rm -f "$WEB_PID"; err "Web 기동 실패 — $WEB_LOG 확인"; fi
}
stop_web() { kill_tree "$WEB_PID" "Web"; }

# ── status ─────────────────────────────────────────────────────────────────
status() {
  printf '\n  %s모일까 로컬 dev 스택%s\n\n' "$C_DIM" "$C_RST"
  if db_running; then
    local health; health="$(db_compose ps 2>/dev/null | grep -o 'healthy\|unhealthy\|starting' | head -1 || true)"
    ok "dev DB   실행 중 (moilga-dev-postgres, :$DEV_DB_PORT${health:+, $health})"
  else
    warn "dev DB   중지됨"
  fi
  local ap; ap="$(pid_alive "$API_PID")"
  if [ -n "$ap" ]; then ok "dev API  실행 중 (pid $ap, :$DEV_API_PORT)"; else warn "dev API  중지됨"; fi
  local wp; wp="$(pid_alive "$WEB_PID")"
  if [ -n "$wp" ]; then ok "dev Web  실행 중 (pid $wp, :$DEV_WEB_PORT)"; else warn "dev Web  중지됨"; fi

  printf '\n  %s운영 스택 (docker, 이 스크립트가 제어하지 않음)%s\n\n' "$C_DIM" "$C_RST"
  local prod; prod="$( (cd "$ROOT_DIR" && docker compose -p "$PROD_PROJECT" ps --format '{{.Service}} {{.Status}}' 2>/dev/null) || true )"
  if [ -n "$prod" ]; then
    printf '%s\n' "$prod" | while read -r line; do ok "prod    $line"; done
  else
    warn "prod    실행 중인 컨테이너 없음 (프로젝트 $PROD_PROJECT)"
  fi
  printf '\n'
}

# ── logs ───────────────────────────────────────────────────────────────────
logs() {
  case "${1:-api}" in
    api) say "API 로그 (Ctrl-C 로 빠져나옴)"; tail -f "$API_LOG" ;;
    web) say "Web 로그 (Ctrl-C 로 빠져나옴)"; tail -f "$WEB_LOG" ;;
    db)  db_compose logs -f postgres ;;
    *)   err "알 수 없는 로그 대상: $1 (api|web|db)"; exit 1 ;;
  esac
}

# ── 디스패치 ───────────────────────────────────────────────────────────────
target="${2:-all}"

case "${1:-}" in
  start)
    case "$target" in
      all) start_db; start_api; start_web; printf '\n'; status ;;
      db)  start_db ;;
      api) start_api ;;
      web) start_web ;;
      *) err "대상: all|db|api|web"; exit 1 ;;
    esac
    ;;
  stop)
    case "$target" in
      all) stop_web; stop_api; stop_db ;;
      db)  stop_db ;;
      api) stop_api ;;
      web) stop_web ;;
      *) err "대상: all|db|api|web"; exit 1 ;;
    esac
    ;;
  restart)
    case "$target" in
      all) stop_web; stop_api; stop_db; printf '\n'; start_db; start_api; start_web; printf '\n'; status ;;
      db)  stop_db;  start_db ;;
      api) stop_api; start_api ;;
      web) stop_web; start_web ;;
      *) err "대상: all|db|api|web"; exit 1 ;;
    esac
    ;;
  status) status ;;
  logs)   logs "${2:-api}" ;;
  *)
    cat <<EOF
모일까(moilga) 로컬 개발 스택 제어 — 운영 스택과 포트·프로젝트 분리

  scripts/dev.sh start   [all|db|api|web]   시작 (기본 all)
  scripts/dev.sh stop    [all|db|api|web]   중지 (기본 all)
  scripts/dev.sh restart [all|db|api|web]   재시작 (기본 all)
  scripts/dev.sh status                     로컬 dev + 운영 스택 상태
  scripts/dev.sh logs    [api|web|db]       로그 follow (기본 api)

로컬 dev:  DB=moilga-dev-postgres(:$DEV_DB_PORT) · API(:$DEV_API_PORT) · Web(:$DEV_WEB_PORT)
운영(prod): docker compose 프로젝트 '$PROD_PROJECT' (docker-compose.prod.yml) — 별도 관리
EOF
    exit 1
    ;;
esac
