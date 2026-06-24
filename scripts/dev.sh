#!/usr/bin/env bash
#
# whenever 로컬 개발 스택 제어 스크립트
#
#   DB(Postgres/docker) · API(NestJS:3001) · Web(Next.js:3000) 를 한 번에 띄우고 내린다.
#
# 사용법:
#   scripts/dev.sh start   [all|db|api|web]   # 시작 (기본 all)
#   scripts/dev.sh stop    [all|db|api|web]   # 중지 (기본 all)
#   scripts/dev.sh restart [all|db|api|web]   # 재시작 (기본 all)
#   scripts/dev.sh status                     # 상태 확인
#   scripts/dev.sh logs    [api|web|db]       # 로그 follow (기본 api)
#
# DB 는 docker compose 가 관리(restart: unless-stopped). API/Web 은 dev watch
# 프로세스를 백그라운드로 띄우고 PID 파일(logs/*.pid)로 추적한다.

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

# ── 포트(.env 에서 읽고, 없으면 기본값) ───────────────────────────────────
API_PORT="$(grep -E '^API_PORT=' "$ROOT_DIR/.env" 2>/dev/null | head -1 | cut -d= -f2 || true)"
API_PORT="${API_PORT:-3001}"
WEB_PORT=3000

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

# ── DB (docker compose) ────────────────────────────────────────────────────
# 프로젝트명을 'whenever' 로 고정 — 실행 경로(워크트리 등)와 무관하게
# 항상 같은 컨테이너/네트워크를 재사용한다.
db_compose() { (cd "$ROOT_DIR" && docker compose -p whenever "$@"); }

db_running() {
  db_compose ps --status running --services 2>/dev/null | grep -q '^postgres$'
}

start_db() {
  if db_running; then ok "DB 이미 떠 있음 (postgres)"; return; fi
  say "DB 시작 (docker compose up -d) …"
  db_compose up -d
  # healthcheck 통과까지 대기
  say "postgres healthy 대기 중 …"
  for _ in $(seq 1 30); do
    if db_compose ps 2>/dev/null | grep -q 'healthy'; then ok "DB healthy (포트 5433)"; return; fi
    sleep 1
  done
  warn "DB 가 떴지만 healthcheck 확인 못 함 — 'scripts/dev.sh logs db' 로 확인"
}

stop_db() {
  if ! db_running; then warn "DB 안 떠 있음"; return; fi
  say "DB 중지 (docker compose stop) …"
  db_compose stop postgres >/dev/null
  ok "DB 중지됨 (데이터는 pgdata/ 에 보존)"
}

# ── 백그라운드 dev 프로세스 공통 ───────────────────────────────────────────
# nohup 으로 띄우고 PID 파일에 기록. 자식(watcher)이 떠도 프로세스그룹 단위로
# 잡을 수 있게 setsid 가 있으면 사용.
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
# macOS 엔 setsid 가 없어 프로세스그룹 종료가 안 되므로 트리를 직접 훑는다.
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

# ── API ────────────────────────────────────────────────────────────────────
start_api() {
  local p; p="$(pid_alive "$API_PID")"
  if [ -n "$p" ]; then ok "API 이미 실행 중 (pid $p, :$API_PORT)"; return; fi
  if ! db_running; then warn "DB 가 안 떠 있음 — API 는 DB 필요. 'start db' 먼저 권장"; fi
  say "API 시작 (pnpm dev:api → :$API_PORT) …"
  spawn "API" "$API_PID" "$API_LOG" pnpm --dir "$ROOT_DIR" dev:api
  sleep 1
  local np; np="$(pid_alive "$API_PID")"
  if [ -n "$np" ]; then ok "API 기동 (pid $np) — 컴파일 로그: scripts/dev.sh logs api"; else rm -f "$API_PID"; err "API 기동 실패 — $API_LOG 확인"; fi
}
stop_api() { kill_tree "$API_PID" "API"; }

# ── Web ────────────────────────────────────────────────────────────────────
start_web() {
  local p; p="$(pid_alive "$WEB_PID")"
  if [ -n "$p" ]; then ok "Web 이미 실행 중 (pid $p, :$WEB_PORT)"; return; fi
  say "Web 시작 (pnpm dev:web → :$WEB_PORT) …"
  spawn "Web" "$WEB_PID" "$WEB_LOG" pnpm --dir "$ROOT_DIR" dev:web
  sleep 1
  local np; np="$(pid_alive "$WEB_PID")"
  if [ -n "$np" ]; then ok "Web 기동 (pid $np) — http://localhost:$WEB_PORT"; else rm -f "$WEB_PID"; err "Web 기동 실패 — $WEB_LOG 확인"; fi
}
stop_web() { kill_tree "$WEB_PID" "Web"; }

# ── status ─────────────────────────────────────────────────────────────────
status() {
  printf '\n  %s%s 로컬 스택 상태 %s\n\n' "$C_DIM" "whenever" "$C_RST"
  # DB
  if db_running; then
    local health; health="$(db_compose ps 2>/dev/null | grep postgres | grep -o 'healthy\|unhealthy\|starting' | head -1 || true)"
    ok "DB    실행 중 (postgres, :5433${health:+, $health})"
  else
    warn "DB    중지됨"
  fi
  # API
  local ap; ap="$(pid_alive "$API_PID")"
  if [ -n "$ap" ]; then ok "API   실행 중 (pid $ap, :$API_PORT)"; else warn "API   중지됨"; fi
  # Web
  local wp; wp="$(pid_alive "$WEB_PID")"
  if [ -n "$wp" ]; then ok "Web   실행 중 (pid $wp, :$WEB_PORT)"; else warn "Web   중지됨"; fi
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
whenever 로컬 개발 스택 제어

  scripts/dev.sh start   [all|db|api|web]   시작 (기본 all)
  scripts/dev.sh stop    [all|db|api|web]   중지 (기본 all)
  scripts/dev.sh restart [all|db|api|web]   재시작 (기본 all)
  scripts/dev.sh status                     상태 확인
  scripts/dev.sh logs    [api|web|db]       로그 follow (기본 api)

DB=Postgres(docker :5433) · API=NestJS(:$API_PORT) · Web=Next.js(:$WEB_PORT)
EOF
    exit 1
    ;;
esac
