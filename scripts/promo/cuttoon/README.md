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
- 원본: `cuttoon.html`(슬라이드·레이아웃·앱 UI 카드) + `choco-milk.png`(초코·밀크 AI 생성 이미지, 1024²).
- 사진 배치: `photoPanel()` 위가 둥근 사진 패널 + `counter()` 카드 — 둘이 카드 위에 앞발을 올린 구도. `photoFace()` 는 한 마리 얼굴 원형 크롭(`FACE` 좌표).
- 아트 디렉션: 가운데 정렬 굵은 헤드라인 + 형광펜 강조 + 실제 앱 UI 카드 + 초코·밀크 사진.
- 게시할 때 인스타 'AI 정보' 라벨을 켠다 (주인공 이미지가 AI 생성).
- 브라우저에서 `cuttoon.html?s=4` 로 한 장만 열어 볼 수 있다.

## 브랜드 규칙 (CLAUDE.md §1, §7)

- 앱 UI 카드 안은 CLAUDE.md 토큰 그대로: 1위 = amber 왕관 배지·amber-300 막대·`현재 1위` 칩, 단색.
- 마케팅 이미지 한정 예외: 헤드라인 형광펜(amber-200)과 캐릭터 입체 음영. 앱 UI 에는 쓰지 않는다.
- 🏆 대신 `components/icons/crown.tsx` 와 같은 단색 왕관 path. 이모지 렌더 없음 (캘린더 아이콘도 SVG).
- rose 는 7장 `마감 D-3` 한 군데 (D-2~3 임박 토큰).

- `caption.txt` — 인스타 본문 + 해시태그.
