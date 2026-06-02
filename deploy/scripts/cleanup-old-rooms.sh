#!/usr/bin/env bash
# 오래된 방 정리. api 컨테이너 안에서 기존 배치 스크립트를 실행한다.
# (컨테이너의 DATABASE_URL 이 운영 DB를 가리키므로 추가 설정 불필요)
#   cleanup-old-rooms.sh [보관일수]   # 기본 90일
set -euo pipefail

DAYS="${1:-90}"
CONTAINER="${API_CONTAINER:-whenever-api}"

docker exec "$CONTAINER" node scripts/cleanup-old-rooms.mjs --days "$DAYS"
