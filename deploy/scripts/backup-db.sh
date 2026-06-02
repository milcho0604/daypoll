#!/usr/bin/env bash
# 맥미니 운영 Postgres 일일 백업. launchd/cron 에서 호출.
#   backup-db.sh [백업디렉터리] [보관일수]
# 기본: ~/whenever-backups 에 저장, 14일 지난 백업 삭제.
set -euo pipefail

BACKUP_DIR="${1:-$HOME/whenever-backups}"
KEEP_DAYS="${2:-14}"
CONTAINER="${POSTGRES_CONTAINER:-whenever-postgres}"
DB_USER="${POSTGRES_USER:-whenever}"
DB_NAME="${POSTGRES_DB:-whenever}"

mkdir -p "$BACKUP_DIR"
ts="$(date +%Y%m%d-%H%M%S)"
out="$BACKUP_DIR/whenever-$ts.sql.gz"
tmp="$out.tmp"

# 컨테이너 안에서 pg_dump → 호스트로 gzip 저장 (원자적: tmp 후 mv)
docker exec "$CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$tmp"
mv "$tmp" "$out"
echo "[backup] wrote $out ($(du -h "$out" | cut -f1))"

# 보관기간 지난 백업 정리
find "$BACKUP_DIR" -name 'whenever-*.sql.gz' -type f -mtime +"$KEEP_DAYS" -delete
echo "[backup] pruned backups older than ${KEEP_DAYS}d"

# 복원 예시:
#   gunzip -c whenever-YYYYmmdd-HHMMSS.sql.gz | docker exec -i whenever-postgres psql -U whenever -d whenever
