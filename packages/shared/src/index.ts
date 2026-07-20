// 기획서 8장 API 계약 기반 공용 타입.
// api/web 양쪽에서 import해서 요청/응답 형태를 일치시킨다.

export interface RoomDate {
  id: number;
  date: string; // ISO date, e.g. "2026-04-15"
}

export interface RoomSummary {
  id: string;
  title: string;
  deadline: string | null; // ISO8601 or null = 무기한
  createdAt: string;
}

// 날씨용 지역 — 시·도 단위. 코드는 백엔드 좌표 맵 키, label 은 드롭다운 표시.
// 위치 권한 없이 사용자가 직접 고르는 선택값(선택 안 하면 날씨 미표시).
export const REGIONS = [
  { code: 'seoul', label: '서울' },
  { code: 'busan', label: '부산' },
  { code: 'daegu', label: '대구' },
  { code: 'incheon', label: '인천' },
  { code: 'gwangju', label: '광주' },
  { code: 'daejeon', label: '대전' },
  { code: 'ulsan', label: '울산' },
  { code: 'sejong', label: '세종' },
  { code: 'gyeonggi', label: '경기' },
  { code: 'gangwon', label: '강원' },
  { code: 'chungbuk', label: '충북' },
  { code: 'chungnam', label: '충남' },
  { code: 'jeonbuk', label: '전북' },
  { code: 'jeonnam', label: '전남' },
  { code: 'gyeongbuk', label: '경북' },
  { code: 'gyeongnam', label: '경남' },
  { code: 'jeju', label: '제주' },
] as const;

export type RegionCode = (typeof REGIONS)[number]['code'];

export const REGION_CODES: readonly RegionCode[] = REGIONS.map((r) => r.code);

export function regionLabel(code: string | null | undefined): string | null {
  return REGIONS.find((r) => r.code === code)?.label ?? null;
}

// 후보날짜 하루치 날씨 (Open-Meteo 일별 예보). 예보 가능 범위(약 16일) 밖 날짜는 빠진다.
export interface WeatherDay {
  date: string; // YYYY-MM-DD
  code: number; // WMO weather code
  emoji: string; // 칩에 바로 쓰는 대표 이모지
  label: string; // 한국어 요약 (예: "맑음", "비")
  tempMax: number | null; // °C, 반올림
  tempMin: number | null; // °C, 반올림
}

export interface RoomWeather {
  region: RegionCode | null;
  regionLabel: string | null;
  days: WeatherDay[]; // 예보 범위 내 후보날짜만
}

export interface UpdateRegionRequest {
  region: RegionCode | null; // null = 지역 해제(날씨 끄기)
}

export interface Voter {
  id: number;
  nickname: string;
}

export interface DateResult {
  dateId: number;
  date: string;
  votes: number;
  voters: Voter[]; // 누가 가능한지 (id + nickname). 강퇴/내 표 표시에 사용.
}

export interface RoomDetail extends RoomSummary {
  dates: RoomDate[];
  participantCount: number;
  results: DateResult[];
  createdBy?: string;
  region?: RegionCode | null; // 날씨용 지역 (선택). null/미설정 = 날씨 안 보임.
  // 이번 모임에 아예 참석 못 하는 사람(불참). 날짜가 아니라 사람 단위.
  declined: Voter[];
}

export interface CreateRoomRequest {
  title: string;
  dates: string[]; // ISO date 문자열 배열
  deadline?: string | null;
  createdBy?: string;
  region?: RegionCode | null;
}

export interface CreateRoomResponse {
  roomId: string;
  creatorToken: string;
}

export interface JoinRoomRequest {
  nickname: string;
  pin?: string; // 4자리 숫자, 선택 사항
  // 방 만든 사람의 첫 입장 시 — localStorage 의 creator_token 을 같이 보내면
  // 백엔드가 이 participant 를 방 주인으로 link. PIN 복원 시 creator_token 자동 회수.
  creatorToken?: string;
}

export interface RecoverParticipantRequest {
  pin: string;
  // 같은 방에 같은 PIN 가입자 여러 명일 때만 추가로 묻는 fallback.
  nickname?: string;
}

export interface JoinRoomResponse {
  participantId: number;
  clientToken: string;
  // 같은 방에 같은 닉네임이 있어 자동 차별화 됐으면 최종 닉네임을 돌려준다 ("지수 (2)" 등).
  // 충돌 없으면 입력한 닉네임 그대로.
  nickname?: string;
  // 이 participant 가 방 주인으로 link 되어 있으면 함께 반환 — 다른 기기에서
  // 방 종료 / 마감 수정 / 강퇴 권한 복원.
  creatorToken?: string;
}

export interface UpdateAvailabilitiesRequest {
  dateIds: number[]; // 가능한 날짜 (미선택 = 미정)
}

// 사람 단위 불참 토글. true = 이번 모임 참석 못 함(가능 날짜 전부 비움).
export interface DeclineRequest {
  declined: boolean;
}

// 방문 집계 비콘 — 프론트가 페이지 로드 시 1회 전송 (PII 없음).
// referrer/ref 는 선택 — 서버가 coarse source 라벨로만 분류(원본 URL 저장 안 함).
export interface TrackRequest {
  path: string;
  referrer?: string; // document.referrer (원본은 저장 안 됨, 서버가 분류만)
  ref?: string; // utm_source / ref 쿼리 힌트 (알려진 값만 인정)
}

// 어드민 방문 집계 응답 (대시보드 카드용 요약).
export interface VisitStats {
  today: number;
  last7Days: number;
  daily: { day: string; count: number }[]; // 최근 30일
  topPaths: { path: string; count: number }[]; // 최근 7일 인기 경로
}

// 경로 1개의 창(window)별 방문 카운트 — 방문 상세 페이지의 표 한 줄.
export interface VisitPathRow {
  path: string;
  today: number;
  last7Days: number;
  last30Days: number;
  allTime: number;
}

// 유입 경로(source) 1개의 창별 카운트 — 방문 상세 페이지의 "유입 경로" 한 줄.
// source 는 coarse 라벨 (naver·google·kakao·direct·other host…). PII 없음.
export interface VisitSourceRow {
  source: string;
  today: number;
  last7Days: number;
  last30Days: number;
  allTime: number;
}

// 어드민 방문 상세 페이지 응답 (요약보다 넓게 — 전체 경로 + 90일 추이 + 유입 경로).
export interface VisitDetail {
  today: number;
  last7Days: number;
  last30Days: number;
  allTime: number;
  distinctPaths: number;
  daily: { day: string; count: number }[]; // 최근 90일
  paths: VisitPathRow[]; // 전체 경로, allTime 내림차순
  sources: VisitSourceRow[]; // 유입 경로, allTime 내림차순
}

// 어드민 활동 피드 이벤트 (방 생성·입장·투표·불참을 시간순으로 통합).
export type ActivityType =
  | 'room_created'
  | 'joined'
  | 'voted'
  | 'declined';

export interface ActivityEvent {
  type: ActivityType;
  ts: string; // ISO8601
  roomId: string;
  roomTitle: string;
  nickname?: string; // room_created 제외
  count?: number; // voted 일 때 선택한 날짜 수
}

export interface ActivityFeed {
  events: ActivityEvent[];
  nextBefore: string | null; // 다음 페이지 커서 (더 없으면 null)
}

export interface UpdateDeadlineRequest {
  deadline: string | null;
}

export const HEADER_CLIENT_TOKEN = 'x-client-token';
export const HEADER_CREATOR_TOKEN = 'x-creator-token';

// ─── 공지 팝업 ───────────────────────────────────────────────
// 어드민이 작성/게시하는 메인 화면 공지. 공개 GET /notice 는 게시된 최신 1건(또는 null).
export interface Notice {
  id: number;
  title: string;
  body: string; // 줄바꿈 포함 평문 (프론트에서 whitespace-pre-line 로 렌더)
  scheduledAt: string | null; // ISO8601, 점검 예정 시각(표시용). 없으면 null.
  published: boolean;
  publishedAt: string | null; // ISO8601, 마지막 게시 시각. "현재 공지" 정렬 기준.
  createdAt: string;
  updatedAt: string;
}

// 어드민 작성/수정 입력. published 는 별도 publish 엔드포인트로 토글.
export interface NoticeInput {
  title: string;
  body: string;
  scheduledAt?: string | null;
}

export const HEADER_ADMIN_TOKEN = 'x-admin-token';
