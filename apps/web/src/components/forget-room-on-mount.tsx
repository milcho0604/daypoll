'use client';

import { useEffect } from 'react';
import { forgetRoom } from '@/lib/recent-rooms';

// 방을 못 찾는(삭제/만료) 페이지에서 마운트되면 '내 방' 목록에서 자동 제거.
// → 죽은 링크가 홈 목록에 계속 남지 않게.
export default function ForgetRoomOnMount({ roomId }: { roomId: string }) {
  useEffect(() => {
    forgetRoom(roomId);
  }, [roomId]);
  return null;
}
