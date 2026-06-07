# Screenshots

루트 `README.md` 에서 참조하는 4장 (모바일 뷰포트, 390×844, deviceScaleFactor 2).

| 파일 | 경로 | 내용 |
|---|---|---|
| `main.png` | `/` | 메인 — amber 뱃지 + "언제 모여?" + 3컷 안내 + CTA |
| `create.png` | `/rooms/new` | 방 생성 — 캘린더 3 모드 탭 + 마감일 프리셋 |
| `share.png` | `/rooms/[id]/created` | 링크 발급 — QR 코드 + 카톡 문구 + Share |
| `room.png` | `/rooms/[id]` | 방 화면 — 닉네임 입력 + 실시간 순위(🏆 amber 그라데이션) |

데모 방 ID: `NClOsdPOViPk` (주말 등산 모임 ⛰️, 참여자 5명).

---

## 재캡쳐 (디자인 변경 후)

`playwright` 로 라이브 사이트 자동 캡쳐.

### 한 번만: playwright + Chromium
```bash
pnpm dlx playwright@1 install chromium
npm install --prefix /tmp playwright   # ESM 스크립트가 import 할 수 있게
```

### 캡쳐
```bash
# /tmp/capture.mjs 라는 스크립트로 4장 캡쳐.
PREVIEW_URL=https://daypoll.vercel.app \
DEMO_ROOM=NClOsdPOViPk \
OUT=$(pwd)/docs/screenshots \
PLAYWRIGHT_BROWSERS_PATH=$HOME/Library/Caches/ms-playwright \
node /tmp/capture.mjs
```

스크립트 내용:
```js
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.PREVIEW_URL || 'https://daypoll.vercel.app';
const ROOM = process.env.DEMO_ROOM || 'NClOsdPOViPk';
const OUT = process.env.OUT || './docs/screenshots';
mkdirSync(OUT, { recursive: true });

const pages = [
  { name: 'main', url: '/' },
  { name: 'create', url: '/rooms/new' },
  { name: 'share', url: `/rooms/${ROOM}/created` },
  { name: 'room', url: `/rooms/${ROOM}` },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  colorScheme: 'light',
  locale: 'ko-KR',
});
const page = await ctx.newPage();

for (const p of pages) {
  await page.goto(BASE + p.url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(800);  // 폰트·차트·QR 로드
  await page.screenshot({ path: `${OUT}/${p.name}.png`, fullPage: true });
}
await browser.close();
```

---

## Vercel Preview 에서 캡쳐할 때 주의

- Preview 도메인 (`web-git-<branch>-...vercel.app`) 의 SSR fetch 가 실패할 수 있음 — `NEXT_PUBLIC_API_BASE_URL` 환경변수가 preview 환경에 등록 안 되어 있을 때. **production 도메인 (`daypoll.vercel.app`) 으로 캡쳐하는 게 안전**.
- 디자인 변경분이 prod 에 반영된 후 캡쳐. 변경 push → Vercel build 3~5분 → 캡쳐.

## 모바일 뷰포트 기준

- 390×844 (iPhone 14 Pro). Android 적당히 큰 폰도 비슷.
- `fullPage: true` 라 헤더부터 footer 까지 전부 캡쳐. 스크롤이 길어질수록 세로가 늘어남.
- deviceScaleFactor 2 → 레티나 선명도.

---

> 자동 캡쳐는 정적 화면에 한해 정확. **드래그 다중 선택 같은 인터랙션**은 사람이 직접 체험해야 검증 가능.
