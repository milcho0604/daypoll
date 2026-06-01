'use client';

import { apiBaseUrl, ApiError } from './api';

const TOKEN_KEY = 'whenever_admin_token';
const HEADER = 'x-admin-token';

export function setAdminToken(token: string) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(TOKEN_KEY, token);
}
export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(TOKEN_KEY);
}
export function clearAdminToken() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(TOKEN_KEY);
}

async function adminFetch<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = getAdminToken();
  if (!token) throw new ApiError(401, 'no token');
  const res = await fetch(`${apiBaseUrl}${path}`, {
    method: init.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', [HEADER]: token },
    body: init.body != null ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  });
  if (!res.ok) {
    let payload: unknown = null;
    try {
      payload = await res.json();
    } catch {
      payload = await res.text();
    }
    throw new ApiError(res.status, payload);
  }
  // DELETE 가 빈 본문일 수 있어 안전 처리
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

// ---- types (api shape mirrors) ----
export interface AdminStats {
  totalRooms: number;
  totalParticipants: number;
  totalVotes: number;
  avgParticipantsPerRoom: number;
  activeRooms: number;
  closedRooms: number;
  roomsWithDeadline: number;
  dailyCreated: { day: string; count: number }[];
}

export interface AdminRoomListItem {
  id: string;
  title: string;
  createdAt: string;
  participantCount: number;
  deadline: string | null;
  status: 'active' | 'closed';
}

export interface AdminRoomList {
  rooms: AdminRoomListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminRoomDetail {
  id: string;
  title: string;
  deadline: string | null;
  createdAt: string;
  hasCreator: boolean;
  dates: { dateId: number; date: string; votes: number; voters: string[] }[];
  participants: { id: number; nickname: string; createdAt: string; voteCount: number }[];
}

// ---- calls ----
export function adminGetStats() {
  return adminFetch<AdminStats>('/admin/stats');
}
export function adminListRooms(opts: {
  limit?: number;
  offset?: number;
  order?: 'recent' | 'participants';
  q?: string;
}) {
  const params = new URLSearchParams();
  if (opts.limit != null) params.set('limit', String(opts.limit));
  if (opts.offset != null) params.set('offset', String(opts.offset));
  if (opts.order) params.set('order', opts.order);
  if (opts.q) params.set('q', opts.q);
  return adminFetch<AdminRoomList>(
    `/admin/rooms${params.toString() ? `?${params}` : ''}`,
  );
}
export function adminRoomDetail(roomId: string) {
  return adminFetch<AdminRoomDetail>(`/admin/rooms/${roomId}`);
}
export function adminDeleteRoom(roomId: string) {
  return adminFetch<{ deleted: true }>(`/admin/rooms/${roomId}`, { method: 'DELETE' });
}
export function adminCleanup(days: number) {
  return adminFetch<{ removed: number; days: number }>(`/admin/cleanup`, {
    method: 'POST',
    body: { days },
  });
}
