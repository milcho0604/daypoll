import {
  AddPlaceRequest,
  CreateRoomRequest,
  CreateRoomResponse,
  DateResult,
  HEADER_CLIENT_TOKEN,
  HEADER_CREATOR_TOKEN,
  JoinRoomRequest,
  JoinRoomResponse,
  PlaceResult,
  RecoverParticipantRequest,
  RegionCode,
  RoomDetail,
  RoomWeather,
  UpdateAvailabilitiesRequest,
  UpdateDeadlineRequest,
  UpdateRegionRequest,
  Voter,
} from '@whenever/shared';
import { api } from './api';

export function createRoom(body: CreateRoomRequest) {
  return api<CreateRoomResponse>('/rooms', { method: 'POST', body });
}

export function getRoom(
  roomId: string,
  signal?: AbortSignal,
  revalidate?: number,
) {
  return api<RoomDetail>(`/rooms/${roomId}`, { signal, revalidate });
}

export function getResults(roomId: string, signal?: AbortSignal) {
  return api<{
    results: DateResult[];
    participantCount: number;
    deadline: string | null;
    region: RegionCode | null;
    declined: Voter[];
    confirmedDateId: number | null;
    confirmedDate: string | null;
    confirmedAt: string | null;
    // 구버전 API(배포 순서가 어긋난 몇 분)엔 없다 — 호출부가 ?? 로 받는다.
    places?: PlaceResult[];
    confirmedPlaceId?: number | null;
    confirmedPlaceAt?: string | null;
  }>(`/rooms/${roomId}/results`, { signal });
}

export function joinRoom(roomId: string, body: JoinRoomRequest) {
  return api<JoinRoomResponse>(`/rooms/${roomId}/participants`, {
    method: 'POST',
    body,
  });
}

export function recoverParticipant(
  roomId: string,
  body: RecoverParticipantRequest,
) {
  return api<JoinRoomResponse>(`/rooms/${roomId}/participants/recover`, {
    method: 'POST',
    body,
  });
}

export async function getMe(
  roomId: string,
  clientToken: string,
  signal?: AbortSignal,
) {
  const res = await api<{
    me: null | {
      participantId: number;
      nickname: string;
      dateIds: number[];
      placeIds?: number[]; // 불참 중에도 보존된 내 장소표
      declined: boolean;
    };
  }>(`/rooms/${roomId}/participants/me`, {
    headers: { [HEADER_CLIENT_TOKEN]: clientToken },
    signal,
  });
  return res.me;
}

export function updateAvailabilities(
  roomId: string,
  clientToken: string,
  body: UpdateAvailabilitiesRequest,
) {
  return api<{ dateIds: number[] }>(
    `/rooms/${roomId}/participants/me/availabilities`,
    {
      method: 'PUT',
      headers: { [HEADER_CLIENT_TOKEN]: clientToken },
      body,
    },
  );
}

// 사람 단위 불참 토글.
export function setDecline(
  roomId: string,
  clientToken: string,
  declined: boolean,
) {
  return api<{ declined: boolean }>(
    `/rooms/${roomId}/participants/me/decline`,
    {
      method: 'PUT',
      headers: { [HEADER_CLIENT_TOKEN]: clientToken },
      body: { declined },
    },
  );
}

export function updateDeadline(
  roomId: string,
  creatorToken: string,
  body: UpdateDeadlineRequest,
) {
  return api<{ deadline: string | null }>(`/rooms/${roomId}/deadline`, {
    method: 'PATCH',
    headers: { [HEADER_CREATOR_TOKEN]: creatorToken },
    body,
  });
}

// 모임 확정 (방장 전용) — 후보 dateId 를 최종 날짜로.
export function confirmDate(
  roomId: string,
  creatorToken: string,
  dateId: number,
) {
  return api<{ confirmedDateId: number; confirmedDate: string }>(
    `/rooms/${roomId}/confirm`,
    {
      method: 'POST',
      headers: { [HEADER_CREATOR_TOKEN]: creatorToken },
      body: { dateId },
    },
  );
}

// 확정 해제 (방장 전용).
export function unconfirmDate(roomId: string, creatorToken: string) {
  return api<{ confirmedDateId: null }>(`/rooms/${roomId}/confirm`, {
    method: 'DELETE',
    headers: { [HEADER_CREATOR_TOKEN]: creatorToken },
  });
}

export function getRoomWeather(roomId: string, signal?: AbortSignal) {
  return api<RoomWeather>(`/rooms/${roomId}/weather`, { signal });
}

export function updateRegion(
  roomId: string,
  creatorToken: string,
  region: RegionCode | null,
) {
  const body: UpdateRegionRequest = { region };
  return api<{ region: RegionCode | null }>(`/rooms/${roomId}/region`, {
    method: 'PATCH',
    headers: { [HEADER_CREATOR_TOKEN]: creatorToken },
    body,
  });
}

export function kickParticipant(
  roomId: string,
  creatorToken: string,
  participantId: number,
) {
  return api<{ deleted: true }>(
    `/rooms/${roomId}/participants/${participantId}`,
    {
      method: 'DELETE',
      headers: { [HEADER_CREATOR_TOKEN]: creatorToken },
    },
  );
}

// ─── 장소·메뉴 투표 ─────────────────────────────────────────
export function addPlace(
  roomId: string,
  clientToken: string,
  body: AddPlaceRequest,
) {
  return api<{ placeId: number }>(`/rooms/${roomId}/places`, {
    method: 'POST',
    headers: { [HEADER_CLIENT_TOKEN]: clientToken },
    body,
  });
}

// 등록자 본인(client token) 또는 방장(creator token).
export function deletePlace(
  roomId: string,
  placeId: number,
  tokens: { clientToken?: string; creatorToken?: string },
) {
  return api<{ deleted: true }>(`/rooms/${roomId}/places/${placeId}`, {
    method: 'DELETE',
    headers: {
      ...(tokens.clientToken ? { [HEADER_CLIENT_TOKEN]: tokens.clientToken } : {}),
      ...(tokens.creatorToken
        ? { [HEADER_CREATOR_TOKEN]: tokens.creatorToken }
        : {}),
    },
  });
}

// PUT = 👍 있음, DELETE = 👍 없음 (멱등).
export function setPlaceVote(
  roomId: string,
  clientToken: string,
  placeId: number,
  on: boolean,
) {
  return api<{ placeId: number; voted: boolean }>(
    `/rooms/${roomId}/places/${placeId}/vote`,
    {
      method: on ? 'PUT' : 'DELETE',
      headers: { [HEADER_CLIENT_TOKEN]: clientToken },
    },
  );
}

export function confirmPlace(
  roomId: string,
  creatorToken: string,
  placeId: number,
) {
  return api<{ confirmedPlaceId: number }>(`/rooms/${roomId}/place-confirm`, {
    method: 'POST',
    headers: { [HEADER_CREATOR_TOKEN]: creatorToken },
    body: { placeId },
  });
}

export function unconfirmPlace(roomId: string, creatorToken: string) {
  return api<{ confirmedPlaceId: null }>(`/rooms/${roomId}/place-confirm`, {
    method: 'DELETE',
    headers: { [HEADER_CREATOR_TOKEN]: creatorToken },
  });
}
