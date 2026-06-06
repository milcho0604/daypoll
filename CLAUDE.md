# Claude 에이전트용 작업 규칙

이 파일은 Claude Code 가 매 세션 자동으로 로드한다.
**여기 규칙은 시각적 회귀를 막기 위한 것이라 우선순위가 높다 — 어기면 화면이 깨진다.**

> 일반 코드 규칙은 시스템 프롬프트의 "Doing tasks / Tone and style" 에 있다.
> 이 문서는 그 위에 얹는 **이 프로젝트 한정** 규칙이다.

---

## 1. 디자인 토큰 (어디서나 동일해야 함)

| 토큰 | 라이트 | 다크 |
|---|---|---|
| 배경 | `bg-white` (영역), `bg-zinc-50/없음` (페이지) | `bg-zinc-950` (페이지), `bg-zinc-900` (영역) |
| 보더 | `border-zinc-200` | `border-zinc-800` |
| 텍스트 | `text-zinc-900` (강), `text-zinc-500` (약), `text-zinc-400` (보조) | `text-zinc-100` / `text-zinc-400` / `text-zinc-500` |
| 강조 | `bg-zinc-900 text-white` | `bg-white text-zinc-900` |
| 보조 강조 | `bg-zinc-100 text-zinc-700` | `bg-zinc-800 text-zinc-300` |
| 위험/경고 | `bg-amber-50 text-amber-800` / `bg-red-50 text-red-700` | `bg-amber-950/40 text-amber-200` / `bg-red-950/40 text-red-300` |
| 포커스 ring | `focus:border-zinc-900` | `focus:border-zinc-100` |

**금지** — 위 토큰 밖의 컬러를 새로 끌어다 쓰지 말 것 (특히 `blue-*`, `indigo-*`). 외부 라이브러리가 파란색을 기본으로 주면 **CSS 변수 오버라이드로 zinc 톤에 맞춘다** (예: `globals.css` 의 `.rdp-root` 변수).

---

## 2. 정렬 규칙 (가장 자주 깨지는 영역)

### 2-1. 페이지 컨테이너
- 모든 페이지 루트는 `mx-auto w-full max-w-2xl px-5` 로 좌우 가운데 정렬. 폼/방 생성은 `max-w-md`.
- 좌우 padding 은 **항상 `px-5`** 로 통일. 다른 값은 디자인 톤이 깨진다.
- 하단 sticky 액션바가 있는 페이지는 **반드시 `pb-28` 이상** — 콘텐츠가 액션바에 가려진다.

### 2-2. 카드/섹션
- 카드: `rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900`.
- 섹션 간격: `flex flex-col gap-6` (큰 단락) / `gap-3` (라벨-입력 묶음).
- **혼합 금지** — 한 영역 안에서 `gap-2` 와 `gap-4` 를 섞지 말 것.

### 2-3. 인라인 요소 정렬
- 행 정렬: `flex items-center` 가 기본. text 와 아이콘/뱃지를 같이 두면 **반드시** `items-center`.
- 라벨-값 쌍: `flex items-center justify-between`. wrap 가능한 줄은 `flex flex-wrap items-center gap-x-3 gap-y-1`.
- 칩/뱃지 리스트: `flex flex-wrap gap-2`. **개별 칩 높이 `h-9` 고정** — 한 줄에 키 차이가 나면 위아래로 어긋난다.

### 2-4. 폼 컨트롤 사이즈 (모바일 터치 타깃)
- 입력/버튼 높이: `h-12` (기본), `h-11` (모달 액션), `h-9` (칩/뱃지). **다른 값 금지.**
- 입력 좌우 padding: `px-4` (기본 input), `px-3` (datetime-local 처럼 native 위젯).
- 둥글기: 큰 영역 `rounded-2xl`, 입력 `rounded-xl`, 칩/풀버튼 `rounded-full`.

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

> 사례: react-day-picker 는 기본 `--rdp-accent-color: blue` + 셀 44px 고정. 셀 ≥ 320px (7×44) 라 `px-5` 모바일에서 미세 오버플로. → `globals.css` 의 `.rdp-root` 에서 zinc 톤 + 셀 2.5rem 으로 오버라이드, candidate marker 는 `underline` 으로 selected 와 분리.

---

## 4. 인터랙션 / 상태 표시

- 비활성: `disabled:cursor-not-allowed disabled:bg-zinc-300 dark:disabled:bg-zinc-700`.
- 잠금된 영역 (마감된 방 등): `opacity-60 pointer-events-none` 또는 별도 안내 박스 (`bg-amber-50 ...`).
- 저장 직후 피드백: 짧은 텍스트 라벨 (`저장됨` 등). 선택이 바뀌면 즉시 해제 (잘못된 안심 신호 방지).
- 다이얼로그: `fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40` + 내용은 `rounded-t-2xl sm:rounded-2xl` 로 모바일 풀스크린 시트 / 데스크탑 카드.

---

## 5. 변경 전 자가 점검 (한 컴포넌트 손볼 때마다)

1. **정렬 — `items-center`, `justify-between`, `gap-*` 가 의도대로 들어갔나?**
2. 좁은 폭 (모바일) 에서 가로 스크롤 없는가?
3. 새로 추가한 색이 §1 토큰 안에 있는가?
4. 입력/버튼 높이가 §2-4 사이즈 안에 있는가?
5. 다크모드 짝이 누락되지 않았나?
6. sticky 액션바가 있다면 `pb-28` 이상인가?

이 6개 중 하나라도 어기면 시각적으로 깨진다 — 검증 안 하고 커밋하지 말 것.
