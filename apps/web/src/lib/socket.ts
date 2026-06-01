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
