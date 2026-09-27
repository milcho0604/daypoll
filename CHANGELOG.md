# 변경 이력 (Changelog)

모일까(moilga.com)의 버전별 변경 사항. 최신이 위.
형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/), 버전은 [유의적 버전](https://semver.org/lang/ko/)을 따른다.

- **추가** 새 기능 · **개선** 기존 기능이 나아짐 · **수정** 버그 · **보안** · **성능** · **운영** 인프라·배포·CI
- 사용자용 요약은 [moilga.com/updates](https://moilga.com/updates) (`apps/web/src/lib/updates.ts`)
- 새 버전을 내는 방법은 `CLAUDE.md` §9 릴리스 절차

## [Unreleased]

## [2.0.0] - 2026-09-27

날짜만 정하고 끝나 장소·식당·메뉴는 단톡방에서 다시 정하던 문제를 한 방에서 끝낸다.

### 추가
- **장소·메뉴 투표** — 날짜 투표와 같은 방에서 동시에. 입장한 누구나 후보(이름 + 링크·메모)를 올리고 여러 곳을 고른다. 방장이 확정하면 확정 카드·단톡방 알림 문구·캘린더(.ics) 장소 칸에 반영 ([#86](https://github.com/milcho0604/daypoll/pull/86))
- 지도 링크 붙여넣기 — 네이버 지도·카카오맵 공유 글이나 "이름 + 링크"를 한 칸에 넣으면 링크를 알아서 떼어낸다. 링크 없는 후보도 "지도에서 찾기" ([#86](https://github.com/milcho0604/daypoll/pull/86), [#88](https://github.com/milcho0604/daypoll/pull/88))
- 방 만들 때 장소 후보 미리 넣기(선택), 후보 수정(표 유지) ([#86](https://github.com/milcho0604/daypoll/pull/86))
- 투표 달력·날씨 접기 — 방별로 기억해서 다시 들어와도 접힌 채 ([#91](https://github.com/milcho0604/daypoll/pull/91))

### 개선
- 마감 시각 고르기를 앱 달력 + 시간 목록으로 교체 (폰마다 깨져 보이던 기본 날짜 입력칸 제거) ([#88](https://github.com/milcho0604/daypoll/pull/88))
- 장소 카드를 한 줄로, 3곳 미리보기 + 더 보기, 날짜 순위 아래로 이동 — 방 페이지 길이 단축 ([#90](https://github.com/milcho0604/daypoll/pull/90))
- 카드 아무 데나 눌러 투표, 메모 칸 ✕, 폼 열 때 키패드 자동 표시 제거 ([#88](https://github.com/milcho0604/daypoll/pull/88), [#89](https://github.com/milcho0604/daypoll/pull/89))
- 내가 고른 날짜·장소를 초록색으로 (검정 → emerald), 달력 안내문 여백 ([#91](https://github.com/milcho0604/daypoll/pull/91))

### 수정
- 달력 화살표·오늘 날짜·체크박스가 파란색으로 나오던 것, 다크모드 달력 색 규칙이 동작하지 않던 것 ([#87](https://github.com/milcho0604/daypoll/pull/87), [#88](https://github.com/milcho0604/daypoll/pull/88))
- 어드민 화면에서 서버 오류 응답을 두 번 읽어 에러 안내가 사라지던 것 ([#85](https://github.com/milcho0604/daypoll/pull/85))
- 결과 동기화 중 늦게 온 옛 응답이 최신 확정 상태를 되돌리던 경쟁 ([#86](https://github.com/milcho0604/daypoll/pull/86))

### 운영
- DB 마이그레이션 `0015_room_places` (장소 테이블 2 + rooms 컬럼 2, FK 역인덱스, `lock_timeout`)

## [1.6.0] - 2026-09-20

### 성능
- 방 페이지 ISR 복구 + 홈 ISR, Vercel 함수 서울 리전(icn1), FK 역인덱스, 조회 병렬화 ([#77](https://github.com/milcho0604/daypoll/pull/77))
- API 호출마다 붙던 CORS preflight 제거 — 투표 한 번에 OPTIONS 3→1 ([#78](https://github.com/milcho0604/daypoll/pull/78))

### 수정
- 첫 방문자에게 후보 날짜가 안 보이던 것, 방 만들기 hydration mismatch ([#73](https://github.com/milcho0604/daypoll/pull/73))
- 모달 안의 실패가 안 보이던 것, 복사 실패 무반응 ([#74](https://github.com/milcho0604/daypoll/pull/74))
- 저장 후 동기화 실패를 "저장 실패"로 잘못 보여주던 것 ([#78](https://github.com/milcho0604/daypoll/pull/78))
- 서버가 복구돼도 "점검 중"이 계속 뜨던 것 ([#81](https://github.com/milcho0604/daypoll/pull/81))
- 홈 헤더 hydration mismatch (React #418) ([#84](https://github.com/milcho0604/daypoll/pull/84))
- 투표를 취소한 날짜가 순위에 회색으로 남던 것 ([#66](https://github.com/milcho0604/daypoll/pull/66))

### 운영
- 인증서 만료 현황 상시 이슈 + 모든 호스트 TLS 감시 ([#76](https://github.com/milcho0604/daypoll/pull/76), [#82](https://github.com/milcho0604/daypoll/pull/82))
- 배포용 Tailscale 키 만료일 갱신 ([#68](https://github.com/milcho0604/daypoll/pull/68))

## [1.5.0] - 2026-08-23

### 추가
- 서버가 끊기면 "점검 중" 팝업 ([#63](https://github.com/milcho0604/daypoll/pull/63))
- 마크다운 블로그 + 비공개 글, 목차 접기 ([#60](https://github.com/milcho0604/daypoll/pull/60), [#62](https://github.com/milcho0604/daypoll/pull/62))

### 보안
- 블로그 렌더 보안·접근성 검증 강화, 개발 도구 전이 의존성 패치 ([#60](https://github.com/milcho0604/daypoll/pull/60), [#61](https://github.com/milcho0604/daypoll/pull/61))

## [1.4.1] - 2026-08-01

### 수정
- 전체 코드 리뷰 후속 11건 — 확정 팝업이 안 열리던 것, 표 유실, 경로 탐색, sanitize, 집계 카디널리티 ([#52](https://github.com/milcho0604/daypoll/pull/52))

## [1.4.0] - 2026-07-21

### 추가
- **모임 확정** — 방장이 날짜를 못박으면 투표 잠금 + 전원에게 배너, 미투표자 넛지 ([#49](https://github.com/milcho0604/daypoll/pull/49))
- 확정 후 "단톡방에 확정 알리기" ([#51](https://github.com/milcho0604/daypoll/pull/51))
- **불참** — 이번 모임에 못 오는 사람 표시 (날짜별 "못 가요" → 사람 단위) ([#38](https://github.com/milcho0604/daypoll/pull/38), [#46](https://github.com/milcho0604/daypoll/pull/46))
- 어드민 공지 팝업 (메인 화면 · 다시 보지 않기) ([#43](https://github.com/milcho0604/daypoll/pull/43))
- 어드민 방문 집계·활동 피드·유입 경로(개인정보 없이 출처 라벨만) ([#46](https://github.com/milcho0604/daypoll/pull/46), [#47](https://github.com/milcho0604/daypoll/pull/47), [#48](https://github.com/milcho0604/daypoll/pull/48))

### 개선
- 순위 1위 표시에서 그라데이션·트로피 이모지 제거 (단색 + 왕관 아이콘) ([#40](https://github.com/milcho0604/daypoll/pull/40))
- 입장·PIN 문구를 비개발자 눈높이로 ([#41](https://github.com/milcho0604/daypoll/pull/41))

### 수정
- 날씨 불러오기가 한 번 실패하면 영영 숨던 것 + 날씨 하드닝 ([#36](https://github.com/milcho0604/daypoll/pull/36), [#37](https://github.com/milcho0604/daypoll/pull/37))
- 어드민 방 목록 모바일 깨짐, 지역 선택 화살표 잘림 ([#42](https://github.com/milcho0604/daypoll/pull/42), [#44](https://github.com/milcho0604/daypoll/pull/44))

### 운영
- 배포를 작업 트리가 아니라 커밋된 origin/main 으로 clean 빌드 ([#45](https://github.com/milcho0604/daypoll/pull/45))
- API e2e 를 스펙별 독립 프로세스로 — 간헐 실패 제거 ([#50](https://github.com/milcho0604/daypoll/pull/50))

## [1.3.0] - 2026-06-27

### 추가
- **언제모여 → 모일까** 리브랜딩 (도메인 moilga.com 과 일치)
- 후보 날짜 날씨 (지역 선택 + Open-Meteo)
- 블로그 `/blog` + 첫 글

### 성능
- 비밀번호 해시(scrypt) 비동기화로 서버 멈춤 해소, 배치 INSERT, 어드민 집계 범위 제한

### 수정
- 동시 입장 시 같은 닉네임이 두 번 생기던 경쟁, PIN 실패 기록 메모리 누수
- 어드민 일별 통계 한국 시간 기준, 방 정리 일수 입력 버그, 공유 카드 ✓ 깨짐

## [1.2.0] - 2026-06-21

### 추가
- 방장 권한을 다른 기기에서 PIN 으로 복원, 한 사람 = 한 토큰(폰·PC 동시 사용)

### 개선
- 마감일 수정·방 종료를 "방 관리" 한 버튼으로 통합
- 디자인 톤 정리 — amber 는 1등·확정에만, 나머지는 차분한 zinc. 확정 1위 카드·투표자 팝업

### 보안
- 의존성 취약점 5건 일괄 해소

## [1.1.0] - 2026-06-16

### 추가
- 투표 자동저장, 링크 공유·결과 복사, 투표자 펼쳐보기 ([#23](https://github.com/milcho0604/daypoll/pull/23))
- 마감 확정 화면 + 1위가 보이는 공유 이미지 ([#24](https://github.com/milcho0604/daypoll/pull/24))
- **내 방 목록** — 가입 없이도 들어갔던 방을 다시 찾기 ([#25](https://github.com/milcho0604/daypoll/pull/25), [#27](https://github.com/milcho0604/daypoll/pull/27))
- 순위 사람별 보기, 전체 펼치기 ([#30](https://github.com/milcho0604/daypoll/pull/30), [#31](https://github.com/milcho0604/daypoll/pull/31), [#32](https://github.com/milcho0604/daypoll/pull/32))
- 캘린더 빠른 선택(주말만·평일만·다 가능), 결과 이미지 저장, 만든 사람 표시
- PIN 만으로 복원, 움직임 줄이기 설정 존중

### 개선
- 미응답자 표시·공동 1위·방 종료·모달 통일 ([#33](https://github.com/milcho0604/daypoll/pull/33))
- 글로벌 헤더, 브랜드 파비콘 ([#22](https://github.com/milcho0604/daypoll/pull/22), [#26](https://github.com/milcho0604/daypoll/pull/26))

### 운영
- daypoll.vercel.app → moilga.com 영구 이동, Cloudflare Tunnel 전환 ([#19](https://github.com/milcho0604/daypoll/pull/19), [#21](https://github.com/milcho0604/daypoll/pull/21))
- 백업·정리를 Docker 컨테이너로, Sentry 에러 추적

## [1.0.0] - 2026-06-08

정식 오픈 — moilga.com.

### 추가
- 이용약관·개인정보처리방침, 홈 화면에 추가(PWA), 방문 분석, 보안 헤더, 공유 카드 ([#12](https://github.com/milcho0604/daypoll/pull/12))
- 어드민 대시보드 차트·액션 로그·CSV 내보내기·실시간 피드
- 검색 노출(robots·sitemap), 백엔드 가동 감시 ([#7](https://github.com/milcho0604/daypoll/pull/7))

### 개선
- UI 리프레시 — 친근한 말투 ([#6](https://github.com/milcho0604/daypoll/pull/6))
- 투표 선택 표시가 안 보이던 것, 후보 칩·더 보기 정리 ([#9](https://github.com/milcho0604/daypoll/pull/9)~[#17](https://github.com/milcho0604/daypoll/pull/17))

### 운영
- 도메인 moilga.com 전환 ([#18](https://github.com/milcho0604/daypoll/pull/18)), 인증서 만료 자동 점검

## [0.3.0] - 2026-06-06

### 추가
- 달력으로 후보 날짜 고르기 (개별 · 기간 · 달 전체) + 참여자 캘린더
- 실시간 순위 상위만 보이고 더 보기

### 운영
- 첫 운영 배포 (맥미니 API + Vercel 웹)

## [0.2.0] - 2026-06-02

### 보안
- 방 생성·입장·투표·PIN 복원 레이트리밋, 토큰 상수 시간 비교, 입력 상한 ([#1](https://github.com/milcho0604/daypoll/pull/1), [#3](https://github.com/milcho0604/daypoll/pull/3))

### 운영
- 운영 Docker 구성 + CI/CD + Cloudflare Tunnel ([#2](https://github.com/milcho0604/daypoll/pull/2))
- DB 백업·오래된 방 정리 자동화 ([#3](https://github.com/milcho0604/daypoll/pull/3))

## [0.1.0] - 2026-06-01

첫 동작 버전.

### 추가
- 방 만들기 → 링크 공유 → 닉네임으로 입장 → 가능한 날짜 투표 → 실시간 순위
- 마감일, 방장 강퇴, PIN 으로 다른 기기 복원, 결과 캘린더(.ics), 공유 이미지(OG)
- Socket.IO 실시간 반영, 어드민 페이지

[Unreleased]: https://github.com/milcho0604/daypoll/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/milcho0604/daypoll/compare/v1.6.0...v2.0.0
[1.6.0]: https://github.com/milcho0604/daypoll/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/milcho0604/daypoll/compare/v1.4.1...v1.5.0
[1.4.1]: https://github.com/milcho0604/daypoll/compare/v1.4.0...v1.4.1
[1.4.0]: https://github.com/milcho0604/daypoll/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/milcho0604/daypoll/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/milcho0604/daypoll/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/milcho0604/daypoll/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/milcho0604/daypoll/compare/v0.3.0...v1.0.0
[0.3.0]: https://github.com/milcho0604/daypoll/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/milcho0604/daypoll/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/milcho0604/daypoll/releases/tag/v0.1.0
