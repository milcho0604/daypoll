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
  dateIds: number[];
}

export interface UpdateDeadlineRequest {
  deadline: string | null;
}

export const HEADER_CLIENT_TOKEN = 'x-client-token';
export const HEADER_CREATOR_TOKEN = 'x-creator-token';
