# Claude 에이전트용 작업 규칙

이 파일은 Claude Code 가 매 세션 자동으로 로드한다.
**여기 규칙은 시각적 회귀를 막기 위한 것이라 우선순위가 높다 — 어기면 화면이 깨진다.**

> 일반 코드 규칙은 시스템 프롬프트의 "Doing tasks / Tone and style" 에 있다.
> 이 문서는 그 위에 얹는 **이 프로젝트 한정** 규칙이다.

---

## 1. 디자인 토큰 (어디서나 동일해야 함)

### 1-1. 톤
- **베이스: zinc** — 차분한 무채색.
- **액센트: amber** — 강조·선택·1위·상호작용 hot path.
- **시멘틱**: success=emerald, warning=amber, danger=rose.

| 토큰 | 라이트 | 다크 |
|---|---|---|
| 페이지 배경 | `bg-white` (또는 CSS `--bg-page` = stone-50 톤) | `bg-zinc-950` |
| 영역(카드/모달) 배경 | `bg-white` | `bg-zinc-900` |
| 보더 | `border-zinc-200` | `border-zinc-800` |
| 텍스트 | `text-zinc-900` (강) / `text-zinc-500` (약) / `text-zinc-400` (보조) | `text-zinc-100` / `text-zinc-400` / `text-zinc-500` |
| 강조(고대비) | `bg-zinc-900 text-white` | `bg-white text-zinc-900` |
| 보조 강조 | `bg-zinc-100 text-zinc-700` | `bg-zinc-800 text-zinc-300` |
| **액센트(amber)** | `bg-amber-100 text-amber-900`, `border-amber-300`, `focus:border-amber-500` | `bg-amber-950/40 text-amber-200`, `border-amber-700`, `focus:border-amber-400` |
| 시멘틱 success | `bg-emerald-100 text-emerald-800` / `text-emerald-600` | `bg-emerald-950/40 text-emerald-200` / `text-emerald-400` |
| 시멘틱 warning | `bg-amber-50 text-amber-800` / `text-amber-600` | `bg-amber-950/40 text-amber-200` / `text-amber-400` |
| 시멘틱 danger | `bg-rose-50 text-rose-700` / `text-rose-600` | `bg-rose-950/40 text-rose-300` / `text-rose-400` |
| 1등/특별 강조 | `bg-gradient-to-br from-amber-400 to-amber-600` + ring + 🏆 | 동일 |

**금지** — 위 토큰 밖의 컬러를 새로 끌어다 쓰지 말 것. 특히 `blue-*`, `indigo-*`, `violet-*`. 외부 라이브러리가 파란색을 기본으로 주면 **CSS 변수 오버라이드로 zinc/amber 톤에 맞춘다** (예: `globals.css` 의 `.rdp-root` 변수, recharts 의 `stroke`/`fill`).

### 1-2. 차트 색 (recharts)
- 단일 시리즈: `#f59e0b` (amber-500). 그라데이션이면 `from-amber-400 to-amber-600`.
- 다중 시리즈: amber(`#f59e0b`) → zinc(`#71717a`) → emerald(`#10b981`) 순.
- 축/그리드: `stroke="#e4e4e7"`, `tick.fill="#71717a"` (라이트 기준).

---

## 2. 정렬 규칙 (가장 자주 깨지는 영역)

### 2-1. 페이지 컨테이너
- 모든 페이지 루트는 `mx-auto w-full max-w-2xl px-5` 로 좌우 가운데 정렬. 폼/방 생성/공유는 `max-w-md` 또는 `max-w-xl`.
- 좌우 padding 은 **항상 `px-5`** 로 통일. 다른 값은 디자인 톤이 깨진다.
- 하단 sticky 액션바가 있는 페이지는 **반드시 `pb-28` 이상** — 콘텐츠가 액션바에 가려진다.
- **글로벌 footer** (`apps/web/src/app/layout.tsx`) 가 모든 페이지 하단에 자동 출력 — sticky 액션바보다 아래라 가려지지 않게 사이즈 작게 유지.

### 2-2. 카드/섹션
- 카드: `rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900`.
- 섹션 간격: `flex flex-col gap-6` (큰 단락) / `gap-3` (라벨-입력 묶음).
- **혼합 금지** — 한 영역 안에서 `gap-2` 와 `gap-4` 를 섞지 말 것.

### 2-3. 인라인 요소 정렬
- 행 정렬: `flex items-center` 가 기본. text 와 아이콘/뱃지를 같이 두면 **반드시** `items-center`.
- 라벨-값 쌍: `flex items-center justify-between`. wrap 가능한 줄은 `flex flex-wrap items-center gap-x-3 gap-y-1`.
- 칩/뱃지 리스트: `flex flex-wrap gap-2`. **개별 칩 높이 `h-9` 고정** — 한 줄에 키 차이가 나면 위아래로 어긋난다.

### 2-4. 폼 컨트롤 사이즈 (모바일 터치 타깃)
- 입력/버튼 높이: `h-14` (CTA 큰 버튼) / `h-12` (기본) / `h-11` (모달 액션) / `h-10` (보조 액션) / `h-9` (칩·뱃지). **다른 값 금지.**
- 입력 좌우 padding: `px-4` (기본 input), `px-3` (datetime-local 같은 native 위젯).
- 둥글기: 큰 영역 `rounded-2xl`, 입력 `rounded-xl`, 칩·풀버튼 `rounded-full`.

### 2-5. 그리드
- 모바일 우선. `grid-cols-2 sm:grid-cols-3` 식으로 확장. **`md:` 이전에 `sm:` 부터 고려.**
- 셀 사이즈는 `h-14` 같이 고정해 행간을 일정하게.
- 캘린더 같은 7열 위젯은 **부모에 `overflow-x-auto` 를 두지 말고, 셀 폭을 줄여서 들어가게** 한다 (`px-5` + `max-w-md` 면 셀 ≤ 40px). 가로 스크롤이 생기면 디자인 깨진 신호.

---

## 3. 외부 UI 라이브러리 도입 절차

1. 라이브러리의 **기본 CSS 가 우리 토큰과 맞는지 확인.** 안 맞으면 그 자리에서 도입 중단하고 `globals.css` 에 CSS 변수 오버라이드부터 작성.
2. **모바일 좁은 폭 (360px) 에서 가로 오버플로 없는지** 확인. 셀 사이즈가 px 고정이면 `rem` 또는 `clamp()` 로 줄인다.
3. 라이브러리 modifier (예: `selected`, `today`, `disabled`) 와 우리가 얹는 modifier 가 **시각적으로 겹치지 않게** 한다. 둘 다 `ring` 이거나 둘 다 `bg` 면 충돌한다 → 우리 쪽은 `underline` / `font-weight` 같이 비충돌 표현으로.
4. 다크모드는 별도 셀렉터 (`.dark .rdp-root` 등) 로 변수만 바꿔 일관성 유지.

> 사례 1 — **react-day-picker**: 기본 `--rdp-accent-color: blue` + 셀 44px 고정. 셀 ≥ 320px(7×44) 라 `px-5` 모바일에서 미세 오버플로. → `globals.css` 의 `.rdp-root` 에서 **amber 톤 + 셀 2.5rem** 으로 오버라이드. candidate marker 는 `underline` 으로 selected 와 분리.
>
> 사례 2 — **recharts**: 기본 `#8884d8` (보라). amber 로 통일 (`stroke="#f59e0b"`, gradient `from-amber-400 to-amber-600`). 데이터 없을 때 차트 컴포넌트 안에 `EmptyState` 출력 (아래 §5 참고).

---

## 4. 마이크로 인터랙션

`globals.css` 에 정의된 유틸 클래스 — 추가 패키지 없이 적용.

| 클래스 | 효과 | 어디에 |
|---|---|---|
| `lift` | hover 시 살짝 위로 + 그림자 | 결과 카드·리스트 아이템·KPI 카드 |
| `press` | active 시 살짝 축소 (touch feedback) | 모든 버튼·CTA·칩 |
| `fade-up` | 마운트 시 아래에서 살짝 올라오며 페이드인 | 메인 페이지 hero, 입장 카드, 결과 첫 진입 |
| `pop-in` | 마운트 시 작게 시작해 spring 느낌 | QR 코드 등장, 뱃지 강조 |

**조합 원칙**:
- 모든 클릭 가능 버튼/링크에 **`press` 기본**.
- 카드형 리스트에는 `lift` 기본 (정보 밀도 높은 표/로그 빼고).
- 페이지 진입 시 첫 영역에만 `fade-up` — 모든 영역에 걸면 산만.

상태 표시:
- 비활성: `disabled:cursor-not-allowed disabled:bg-zinc-300 dark:disabled:bg-zinc-700`.
- 잠금된 영역 (마감된 방 등): `opacity-60 pointer-events-none` 또는 별도 안내 박스 (`bg-amber-50 ...`).
- 저장 직후 피드백: 짧은 텍스트 라벨 (`저장됨` 등). 선택이 바뀌면 즉시 해제 (잘못된 안심 신호 방지).
- 다이얼로그: `fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40` + 내용은 `rounded-t-2xl sm:rounded-2xl` 로 모바일 풀스크린 시트 / 데스크탑 카드.

---

## 5. 빈 상태 (EmptyState)

**일반 텍스트 `"데이터가 없습니다"` 직접 출력 금지.** `apps/web/src/components/empty-state.tsx` 의 `<EmptyState emoji="..." message="..." />` 사용.

| 케이스 | emoji | message |
|---|---|---|
| 결과 (아직 표 없음) | `🌱` | 아직 첫 표를 기다리는 중이에요 |
| 후보 날짜 없음 | `📅` | 아직 후보 날짜가 없어요 |
| 검색 결과 없음 | `🔍` | 매칭되는 X 가 없네요 |
| 어드민 차트 (데이터 0) | `📊` | 데이터가 모이는 중이에요 |
| 활동 피드 없음 | `📭` | 아직 활동이 없어요 |
| 로그 없음 | `📋` | 아직 기록이 없어요 |
| 참여자 없음 | `👥` | 아직 참여자가 없어요 |

새 빈 상태가 필요하면 위 표에 행 하나 추가 — 즉흥적으로 다른 이모지 쓰지 말 것.

---

## 6. 글로벌 footer

`apps/web/src/app/layout.tsx` 의 footer 는 **모든 페이지에 자동 출력**:
- 1줄: `문의 · hello.mealplan@gmail.com · 버그 제보(GitHub Issues)`
- 2줄: `개인정보처리방침 · 이용약관`
- `text-[11px] text-zinc-400` 사이즈 — 작게 유지
- `pb-[calc(env(safe-area-inset-bottom)+1rem)]` — iOS 홈 인디케이터 영역 보호
- `z-0` — fixed bottom 바 (z-20) 가 항상 위로 깔리도록 보장

페이지별 footer 별도 작성 금지 — 글로벌 footer 와 중복.

---

## 7. 한국어 카피라이팅

- **친구 모임 컨텍스트**라 친근 톤. 비즈니스 SaaS 어투 피하기.
- "방 만들기" / "친구들이 당신을 뭐라고 부를까요?" / "친구들한테 뿌리기만 하면 끝!" 처럼 구어체.
- **금지 표현**: "데이터가 없습니다.", "오류 발생", "처리되었습니다" — 딱딱하다.

### 표준 띄어쓰기
- 부사 + 동사: 띄움 ("언제 모여?" ✓ — "언제모여" ✗ in 의문문). 단, **브랜드명**으로 쓸 때는 붙임 ("언제모여" — 메타 title, footer).
- 의존명사 "수": 띄움 ("할 수 있어요").
- 영문 + 조사: **붙임** ("PIN으로", "API를"). "PIN 으로" 같이 띄우면 잘못.
- 받침 명사 + 이에요/예요: 받침 있으면 "이에요" (모임이에요). 받침 없으면 "예요" (친구예요).

---

## 8. 변경 전 자가 점검 (한 컴포넌트 손볼 때마다)

1. **정렬** — `items-center` / `justify-between` / `gap-*` 가 의도대로 들어갔나?
2. 좁은 폭 (모바일 360px) 에서 가로 스크롤 없는가?
3. 새로 추가한 색이 §1 토큰 안에 있는가? (blue-*, indigo-* 금지)
4. 입력/버튼 높이가 §2-4 사이즈 안에 있는가?
5. 다크모드 짝이 누락되지 않았나?
6. sticky 액션바가 있다면 `pb-28` 이상인가?
7. 빈 상태에 일반 `<p>"데이터 없음"</p>` 안 썼나? — `EmptyState` 사용했나?
8. 모든 버튼에 `press` 인터랙션 들어갔나?
9. 한국어 카피가 친근 톤인가? 띄어쓰기 표준인가?

이 9개 중 하나라도 어기면 시각적으로 깨지거나 톤이 안 맞는다 — 검증 안 하고 커밋하지 말 것.
