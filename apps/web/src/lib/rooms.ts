import {
  CreateRoomRequest,
  CreateRoomResponse,
  DateResult,
  HEADER_CLIENT_TOKEN,
  HEADER_CREATOR_TOKEN,
  JoinRoomRequest,
  JoinRoomResponse,
  RecoverParticipantRequest,
  RegionCode,
  RoomDetail,
  RoomWeather,
  UpdateAvailabilitiesRequest,
  UpdateDeadlineRequest,
  UpdateRegionRequest,
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
    me: null | { participantId: number; nickname: string; dateIds: number[] };
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
