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
}

export interface CreateRoomRequest {
  title: string;
  dates: string[]; // ISO date 문자열 배열
  deadline?: string | null;
}

export interface CreateRoomResponse {
  roomId: string;
  creatorToken: string;
}

export interface JoinRoomRequest {
  nickname: string;
}

export interface JoinRoomResponse {
  participantId: number;
  clientToken: string;
}

export interface UpdateAvailabilitiesRequest {
  dateIds: number[];
}

export interface UpdateDeadlineRequest {
  deadline: string | null;
}

export const HEADER_CLIENT_TOKEN = 'x-client-token';
export const HEADER_CREATOR_TOKEN = 'x-creator-token';
