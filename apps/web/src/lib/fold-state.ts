'use client';

import { useCallback, useEffect, useState } from 'react';

// 방 화면 영역(투표 달력·날씨) 접힘 상태 — 방별로 localStorage 에 기억해서
// 다음에 다시 들어와도 접은 건 접힌 채로 보인다.
// 사생활 모드·저장소 차단이면 조용히 기억만 못 할 뿐 화면은 정상 동작.

const keyOf = (roomId: string, section: string) =>
  `whenever_fold:${roomId}:${section}`;

export function readFold(roomId: string, section: string): boolean | null {
  try {
    const v = window.localStorage.getItem(keyOf(roomId, section));
    return v === 'open' ? true : v === 'closed' ? false : null;
  } catch {
    return null;
  }
}

export function writeFold(roomId: string, section: string, open: boolean) {
  try {
    window.localStorage.setItem(keyOf(roomId, section), open ? 'open' : 'closed');
  } catch {
    /* 저장 못 해도 이번 화면에선 동작 */
  }
}

// 저장된 값이 있으면 그걸, 없으면 fallbackOpen 을 쓴다.
// fallbackOpen 이 null 이면 "아직 판단 전"(예: 내 표 로딩 중) — 일단 펼친 걸로 둔다.
// 서버 렌더와 첫 클라이언트 렌더를 맞추려고 저장값은 마운트 뒤에 읽는다.
export function useFoldState(
  roomId: string,
  section: string,
  fallbackOpen: boolean | null,
): [boolean, (open: boolean) => void] {
  const [stored, setStored] = useState<boolean | null>(null);
  useEffect(() => {
    // localStorage 는 클라이언트 전용이라 마운트 시 동기화 (1회, cascading 아님)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStored(readFold(roomId, section));
  }, [roomId, section]);
  const setOpen = useCallback(
    (open: boolean) => {
      setStored(open);
      writeFold(roomId, section, open);
    },
    [roomId, section],
  );
  return [stored ?? fallbackOpen ?? true, setOpen];
}
