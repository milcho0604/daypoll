#!/usr/bin/env bash
# 검수용 컨택트시트: 지정 시각 10장을 5×2 한 장으로.
#   bash sheet.sh <프로젝트 폴더> <이름> 1.0,6.9,...   → <프로젝트>/sheet-<이름>.png
# 전환 중간(장면 경계 ±0.4초) 프레임을 꼭 섞어서 볼 것.
set -euo pipefail
DIR=$(cd "$1" && pwd); NAME=$2; TIMES=$3
: "${FFMPEG:?먼저 setup.sh 의 export FFMPEG=... 를 적용하세요}"
cd "$DIR"
rm -rf frames
node render.mjs --stills "$TIMES" >/dev/null
"$FFMPEG" -y -loglevel error -pattern_type glob -i 'frames/still-*.png' \
  -vf "scale=324:576,tile=5x2:padding=6:color=white" -frames:v 1 "sheet-$NAME.png"
echo "$DIR/sheet-$NAME.png"
