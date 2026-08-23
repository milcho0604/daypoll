# 모일까 Markdown 블로그 작성 가이드

블로그 글은 `apps/web/content/blog/*.md` 파일로 관리한다. 파일명은 URL slug가 되므로 영문 소문자, 숫자, 하이픈만 사용한다.

```text
apps/web/content/blog/my-first-post.md
→ https://moilga.com/blog/my-first-post
```

## 새 글 템플릿

````md
---
title: "글 제목"
date: "2026-08-17"
updated: "2026-08-18"
publishAt: "2026-08-20T09:00:00+09:00"
description: "목록과 검색 결과에 표시할 200자 이내의 소개문"
category: "개발 기록"
tags: [nextjs, markdown, 회고]
visibility: public
draft: false
cover: "/blog/images/my-first-post.webp"
coverAlt: "대표 이미지 설명"
---

## 첫 번째 제목

본문은 일반적인 **GitHub Flavored Markdown**으로 작성한다.

### 코드 예시

```ts
const message = '코드 블록은 빌드할 때 문법이 강조됩니다.';
```
````

본문의 페이지 제목은 화면에서 자동으로 H1이 된다. 따라서 Markdown 본문은 `##`부터 시작한다.

## Frontmatter 필드

| 필드 | 필수 | 설명 |
|---|---:|---|
| `title` | O | 100자 이하 제목 |
| `date` | O | 최초 작성일, `YYYY-MM-DD` |
| `updated` | X | 수정일, 작성일보다 빠를 수 없음 |
| `publishAt` | X | public 예약 발행 시각. 시간대가 포함된 ISO 8601 |
| `description` | O | 목록·SEO 소개문, 200자 이하 |
| `category` | O | 한 개의 대표 카테고리, 30자 이하 |
| `tags` | O | 1~10개 태그, 각 30자 이하 |
| `visibility` | O | `public` 또는 `private` |
| `draft` | X | 기본 `false`. `true`는 개발 환경에서만 노출 |
| `cover` | X | `/public` 기준 `/`로 시작하는 내부 이미지 경로 |
| `coverAlt` | X | 대표 이미지 대체 텍스트 |

파서가 필수값, 날짜, slug, 제목 단계와 공개 정책을 빌드 전에 검증한다. 지원하지 않는 필드, 잘못된 타입과 제어 문자도 오류로 처리한다. 잘못된 글은 조용히 누락하지 않고 빌드를 실패시켜 배포 전에 발견할 수 있다.

## public과 private

`visibility: public` 글은 다음 위치에 노출된다.

- `/blog` 목록, 검색, 카테고리·태그 필터
- 사이트맵과 검색엔진 메타데이터
- `/blog/feed.xml` RSS 피드
- 글별 Open Graph 이미지

`visibility: private` 글은 공개 목록·RSS·사이트맵·검색엔진·공개 OG 이미지에서 제목과 본문을 숨긴다. 글 URL에서도 기존 모일까 어드민의 `ADMIN_TOKEN`을 API로 검증한 뒤에만 본문을 내려받는다. 이미 `/admin`에 로그인한 브라우저는 같은 탭 세션의 권한을 재사용하며, 별도 블로그 비밀번호나 Vercel 환경변수는 필요하지 않다. **관리자 로그아웃**을 누르면 어드민 세션도 함께 지워진다.

잘못된 관리자 토큰 시도는 10분 동안 제한된다. 인증 감사 로그에는 실패와 해시된 글 식별자만 남고 토큰·IP·제목·본문은 남지 않는다. 비공개 본문 API는 매 요청마다 백엔드 `AdminGuard`를 통과하며 캐시·검색 색인을 금지한다.

`publishAt`이 미래인 public 글은 해당 시각 전까지 목록·상세·RSS·사이트맵·OG에서 숨겨진다. 발행 시각 이후 목록과 피드는 60초 주기로 재검증되고 상세 URL은 첫 요청에서 생성된다. 예약 발행과 `private`는 함께 사용할 수 없다.

`public/` 아래 파일은 URL을 아는 누구나 열 수 있다. 민감한 이미지가 새는 일을 막기 위해 private 글은 대표 이미지와 본문 이미지를 허용하지 않는다. 일반 이미지, 참조형 이미지, raw HTML 이미지 모두 렌더링 결과를 기준으로 차단한다. 비공개 첨부가 필요하면 인증된 전용 파일 저장소와 다운로드 API를 별도로 추가해야 한다.

## 지원 기능

- 표, 체크리스트, 인용문, 링크 등 GitHub Flavored Markdown
- `##`, `###` 기반 자동 목차와 중복 없는 한글 앵커
- 언어가 지정된 코드 블록의 서버 문법 강조
- 읽는 시간과 단어 수 자동 계산
- 외부 링크 새 창 열기와 안전 속성 강제
- 위험한 HTML, 스크립트, `javascript:` 링크 정화
- raw HTML의 H1과 입력 폼 차단, 체크리스트는 비활성 체크박스로 고정
- 수정일, 관련 글, 이전 글·다음 글, 공유 버튼
- 접을 수 있는 목차, 현재 읽는 항목 강조, 읽기 진행률과 맨 위로 이동
- 코드 블록·제목 링크 복사
- 글 조회·읽기 깊이·검색·필터·복사·공유의 비식별 분석 이벤트

## 이미지

공개 글 이미지는 `apps/web/public/blog/images/` 아래에 둔다.

```md
![대시보드 화면](/blog/images/dashboard.webp)
```

가능하면 WebP 또는 AVIF를 사용하고, 의미 있는 대체 텍스트를 반드시 작성한다. 대체 텍스트가 비어 있거나 파일이 없으면 빌드가 실패한다. 원격 추적 픽셀을 막기 위해 본문 이미지도 `/`로 시작하는 `public/` 내부 경로만 허용한다.

## 작성 명령

```bash
# 덮어쓰기 없이 안전한 초안 생성
pnpm blog:new my-first-post --title "첫 번째 글"

# private 초안
pnpm blog:new internal-note --private --title "내부 기록"

# 예약 발행 초안
pnpm blog:new scheduled-note --publish-at "2026-08-20T09:00:00+09:00"

# 전체 Markdown·메타데이터·이미지·글 링크 검증
pnpm blog:check

# 로컬 실시간 미리보기
pnpm blog:preview
```

새 글은 항상 `draft: true`로 생성된다. 내용을 확인한 뒤 `draft: false`로 바꿔 발행한다. `blog:check`는 public 글에서 private 글로 향하는 링크도 차단해 비공개 slug가 실수로 노출되지 않게 한다.

## 배포 전 확인

```bash
pnpm --filter @whenever/web test
pnpm --filter @whenever/web lint
pnpm --filter @whenever/web build
pnpm --filter @whenever/web test:e2e
```

`build`가 통과하면 공개 글의 목록·상세·RSS·사이트맵·OG 이미지까지 함께 정적 생성된다.
