'use client';

import { io, Socket } from 'socket.io-client';
import { apiBaseUrl } from './api';

let _socket: Socket | null = null;

export function getSocket(): Socket {
  if (_socket) return _socket;
  _socket = io(apiBaseUrl, {
    transports: ['websocket', 'polling'],
    autoConnect: true,
    withCredentials: true,
  });
  return _socket;
}

export function joinRoomChannel(roomId: string) {
  const s = getSocket();
  s.emit('room:join', { roomId });
}

export function leaveRoomChannel(roomId: string) {
  const s = getSocket();
  s.emit('room:leave', { roomId });
}

// 어드민 채널 가입 — admin token 으로 서버에 인증. 성공 시 'admin:event' 수신.
export function joinAdminChannel(token: string) {
  const s = getSocket();
  const ensureAuth = () => s.emit('admin:auth', { token });
  if (s.connected) ensureAuth();
  s.on('connect', ensureAuth);
  return () => {
    s.off('connect', ensureAuth);
  };
}
