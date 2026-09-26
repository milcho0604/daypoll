# story.html 엔진 레퍼런스

`example/poodle-myth/story.html` 은 한 파일에 "그림 + 연출 + 자막 + 재생 엔진"이 다 들어 있다.
새 영상은 이 파일을 복사해서 **스타일 가이드 · 캐릭터 함수 · 장면 · 자막**만 바꾸면 된다. 엔진 부분(`빌드` 이후)은 거의 손대지 않는다.

## 1. 렌더 계약 (render.mjs 가 의존하는 것)

| 전역 | 의미 |
|---|---|
| `window.DURATION` | 영상 길이(초). render.mjs 가 `DURATION × 30` 프레임을 캡처하고, bgm.py 에도 이 길이를 넘긴다 |
| `window.seek(t)` | t초의 화면을 **완전히 결정적으로** 그린다. 같은 t → 항상 같은 화면 |

규칙: `Math.random()`, `Date.now()`, CSS transition/animation 을 쓰지 않는다. 모든 움직임은 `t` 의 함수.
난수가 필요하면 파일 안의 결정적 난수 `rnd()` 를 쓰고 장면마다 `SEED = 숫자` 로 시드를 고정한다.
브라우저로 파일을 그냥 열면(`navigator.webdriver` 가 false) 실시간 루프 재생되어 미리보기로 쓸 수 있다.

## 2. 파일 구조 (위에서 아래 순서)

| 구역 | 내용 | 새 영상에서 |
|---|---|---|
| 상단 주석 `STYLE GUIDE` | 팔레트·선·캐릭터 규칙 | **수정** |
| `<style>` | 챕터 라벨, 인트로 타이틀, 엔딩, 오버레이(종이결·비네트·테두리), 자막 | 대부분 재사용 |
| `const C`, `SW` | 팔레트 상수, 기본 선 굵기 6 | **수정** |
| 그리기 헬퍼 | `blob(shapes, fill)` 겹친 도형의 합집합 외곽선, `spline(pts)` 부드러운 곡선, 반짝이, `rnd()` | 재사용 |
| 주인공 | `poodleHead(o)`, `poodle(variant, o)` — 원점=발 아래 중앙, 오른쪽을 봄 | **새 주인공 함수로 교체** |
| 보조 캐릭터 | `wolf(fill)` 등 | 필요에 따라 |
| 장면 `S1~S8` | `scene({...})` 호출들 | **새로 작성** |
| `CAPS` | 자막 목록 | **새로 작성** |
| 빌드/엔진 | DOM 생성, `runAnim`, `sceneFrame`, `SCENE_FX`, `captionFrame`, `seek` | `SCENE_FX` 만 수정 |

## 3. `scene()` 옵션

```js
scene({
  id: 's3',                 // DOM id, SCENE_FX 키
  t0: 14, t1: 21.5,         // 절대 시각(초). 다음 장면 t0 = 이 장면 t1
  trans: 'fade',            // 들어올 때 전환: 'fade' | 'iris' | 'wipe'  (길이 TR = 0.9초, 이전 장면과 겹침)
  iris: [540, 900],         // trans:'iris' 일 때 원이 열리는 중심
  zoom: [1, 1.08],          // 켄 번즈 시작→끝 배율
  focus: [540, 1000],       // 줌 중심
  pan: [[-30, 0], [30, 0]], // 카메라 이동 시작→끝 (레이어 depth 를 곱해 패럴랙스)
  panFn: (tl) => [x, y],    // pan 대신 임의 궤적 (예: 서커스 → 숲 가로 이동)
  chap: ['두 번째 이야기', '물의 사냥개'],  // 상단 챕터 라벨
  svg: () => `...`,         // 1080×1920 viewBox 안의 SVG 문자열 (L() 레이어로 감싼다)
  html: '',                 // SVG 위에 얹을 HTML (인트로 타이틀 등)
});
```

- 레이어: `L(depth, inner)` → `<g class="layer" data-depth>`. depth 0 고정, 1 카메라와 같이, >1 전경(더 빠르게).
- 장면 내부 시간 `tl = t - t0`. 전환 구간(다음 장면 t0 ~ t0+0.9)까지 계속 그려진다.

## 4. idle 애니메이션 (`data-anim`)

SVG 요소에 속성만 달면 엔진이 매 프레임 움직인다.

| `data-anim` | 효과 | 주요 속성 |
|---|---|---|
| `wag` | 회전 흔들기 (꼬리) | `data-a` 각도, `data-s` 속도(Hz), `data-cx/cy` 회전축 |
| `bob` | 위아래 둥실 | `data-a` 픽셀 |
| `twinkle` | 반짝임 (투명도+크기) | `data-cx/cy`, `data-p` 위상 |
| `flicker` | 불꽃 일렁임 | `data-a` 세기 |
| `ripple` | 물결 퍼짐 (반복) | `data-s`, `data-cx/cy` |
| `fall` | 떨어짐 (꽃잎·색종이) | `data-r` 낙하 거리, `data-s`, `data-p` |
| `rise` | 떠오름 (하트·불티) | `data-r`, `data-s`, `data-p` |

위상 `data-p` 를 요소마다 다르게 주면 동시에 같이 움직이는 어색함이 사라진다.

## 5. 장면 고유 연출 `SCENE_FX`

```js
const SCENE_FX = {
  s4(tl, t, s) {          // tl = 장면 내부 시간
    // 예: 1.0~3.4초에 가위가 지나가며 natural → clip 으로 바뀌고, 라벨이 차례로 등장
  },
};
```
헬퍼: `appear(el, k, dy)` (HTML 페이드업), `appearSvg(el, k, cx, cy)` (SVG 팝인), `smoothstep`, `easeOut`, `lerp`, `clamp`, `frac`.

## 6. 자막 `CAPS`

```js
const CAPS = [
  [시작초, 끝초, '첫째 줄<br>둘째 줄'],
  ...
];
```
- 하단 1/3, 크림색 판 + 잉크 테두리, 58px Bold, 줄마다 0.2초 간격으로 페이드업.
- 한 자막 약 3초, 장면당 2개. 장면 전환(0.9초) 구간과 겹치지 않게 `t0 + 0.8` 이후에 시작.
- 한 줄이 넘치면 `white-space: nowrap` 때문에 판 밖으로 나간다 → 문장을 줄일 것.

## 7. 음악 `bgm.py`

`python3 bgm.py out.wav <초>` — render.mjs 가 자동 호출.
악기·효과음 함수(`musicbox`, `pad`, `bass`, `whoosh`, `splash`, `snip` 등)를 시간표에 `add(start, samples, pan)` 로 얹는 구조.
장면 경계 시각과 효과음 시각을 **story.html 과 같은 숫자로** 맞춘다. 스테레오, 끝 2.5초 페이드아웃, 소프트 클립.
