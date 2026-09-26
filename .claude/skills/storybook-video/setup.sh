#!/usr/bin/env bash
# storybook-video 렌더 도구 준비. 한 번 실행하고 마지막 줄의 export 를 셸에 적용한다.
#   source <(bash .claude/skills/storybook-video/setup.sh | tail -1)
# - libx264 가 들어간 ffmpeg 를 찾거나, 없으면 imageio-ffmpeg 휠에서 정적 바이너리를 꺼내 온다.
# - Playwright(Chromium) 가 있는지 확인한다. (클라우드 세션엔 전역 설치돼 있음)
# - Pretendard 폰트는 render.mjs 가 처음 실행될 때 npm 에서 받아 온다.
set -euo pipefail
CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/storybook-video"
mkdir -p "$CACHE"

has_x264() { "$1" -hide_banner -encoders 2>/dev/null | grep -c libx264 >/dev/null; }

FF=""
for c in "${FFMPEG:-}" "$(command -v ffmpeg || true)" "$CACHE"/iff/imageio_ffmpeg/binaries/ffmpeg*; do
  [ -n "$c" ] && [ -x "$c" ] && has_x264 "$c" && { FF="$c"; break; }
done
if [ -z "$FF" ]; then
  echo "libx264 ffmpeg 없음 → imageio-ffmpeg 휠에서 가져옴" >&2
  (cd "$CACHE" && pip download imageio-ffmpeg --no-deps -d . -q && unzip -oq imageio_ffmpeg-*.whl -d iff)
  FF=$(ls "$CACHE"/iff/imageio_ffmpeg/binaries/ffmpeg* | head -1)
  chmod +x "$FF"
fi
has_x264 "$FF" || { echo "ffmpeg 준비 실패 — brew install ffmpeg (mac) / apt install ffmpeg" >&2; exit 1; }

node -e "require('playwright')" 2>/dev/null || node -e "require(require('path').join(require('child_process').execSync('npm root -g').toString().trim(),'playwright'))" 2>/dev/null \
  || echo "⚠️ playwright 없음 → npm i -g playwright && npx playwright install chromium" >&2
command -v python3 >/dev/null || echo "⚠️ python3 없음 (BGM 합성에 필요)" >&2

echo "export FFMPEG=$FF"
