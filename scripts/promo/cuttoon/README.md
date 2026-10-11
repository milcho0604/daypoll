# 모일까 컷툰 EP.1 — 인스타 캐러셀

1080×1350 (4:5) 8장. 초코(토이푸들)·밀크(고양이)가 단톡방 약속 지옥에서 모일까로 탈출하는 이야기.

## 다시 렌더하기

```bash
cd scripts/promo/cuttoon
node render.mjs          # 01.png … 08.png + preview.png (4×2 타일)
node render.mjs 3 5      # 03.png, 05.png 만 다시 찍고 preview 갱신
```

- 필요: Playwright + Chromium. 로컬에 없으면 전역 설치본(`npm root -g`)을 쓴다.
- 폰트: `fonts/` 의 Pretendard woff2 (Medium/SemiBold/Bold/ExtraBold) — git 에 없음. `cp -r ../fonts .` (상위 `scripts/promo/render.mjs` 가 처음 실행될 때 npm 에서 받아 온다).
- 원본은 `cuttoon.html` 하나 — 캐릭터(`choco()`, `milk()`, `avatar()`), 말풍선(`say()`), 채팅(`msgL/msgR`, `sheet()`), 레이아웃(`chrome()`, `head()`, `card()`), 슬라이드별 함수(`S.push(...)`).
- 아트 디렉션: 외곽선 없는 플랫 도형 + 점 눈, 왼쪽 정렬 헤드라인, 웜그레이 장면 카드, 장식(반짝이·땀방울·효과선) 없음.
- 브라우저에서 `cuttoon.html?s=4` 로 한 장만 열어 볼 수 있다.

## 브랜드 규칙 (CLAUDE.md §1, §7)

- zinc 베이스, amber 는 7장(실시간 1위: 왕관 배지·amber-300 막대·`현재 1위` 칩)과 8장(확정 칩·보더+ring)에만. 단색, 그라데이션 없음.
- 🏆 대신 `components/icons/crown.tsx` 와 같은 단색 왕관 path. 이모지 렌더 없음 (캘린더 아이콘도 SVG).
- rose 는 7장 `마감 D-3` 한 군데 (D-2~3 임박 토큰).

- `caption.txt` — 인스타 본문 + 해시태그.
