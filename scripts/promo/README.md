# 모일까 광고 영상

`moilga-promo.mp4` — 1080×1920 (9:16, 릴스·쇼츠·스토리용), 30fps, 25초, BGM 포함.

| 구간 | 내용 |
|---|---|
| 0–4초 | 단톡방 혼란 — "난 15일 빼고 다 돼" / "난 15일만 되는데…" + 안 읽은 메시지 128+ |
| 4–7초 | 브랜드 — "언제 모일까?" / 링크 하나로 1분 컷 |
| 7–11초 | STEP 1 — 방 만들기, 캘린더에서 후보 날짜 톡톡 |
| 11–15초 | STEP 2 — 단톡방에 링크 공유, 친구들 반응 |
| 15–21초 | STEP 3 — 실시간 순위, 1위 왕관 → 확정 |
| 21–25초 | 엔딩 — 가입 없음 · 광고 없음 · 무료 / 지금 방 만들기 / moilga.com |

디자인은 CLAUDE.md §1 토큰(zinc 베이스, amber 는 1위·확정만, 그라데이션·🏆 없음)을 따른다.

## 다시 렌더링

```bash
cd scripts/promo
node render.mjs                  # → moilga-promo.mp4
node render.mjs --stills 3,9,18  # 특정 초 스틸 PNG → frames/
```

- `promo.html` — 애니메이션 본체 (브라우저로 열면 바로 재생)
- `bgm.py` — BGM·효과음 합성 (표준 라이브러리만)
- 필요: playwright(chromium), libx264 가 있는 ffmpeg (`FFMPEG=/path/to/ffmpeg`), python3
- Pretendard 폰트는 처음 실행 때 npm 에서 받아 `fonts/` 에 둔다 (gitignore)
