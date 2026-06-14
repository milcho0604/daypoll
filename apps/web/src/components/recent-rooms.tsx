'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { forgetRoom, isCreator, listRooms, type RecentRoom } from '@/lib/recent-rooms';

// 홈에 깔리는 '내 방' 목록. 방문 기록이 없으면 아무것도 렌더하지 않는다(신규 사용자엔 무영향).
const INITIAL = 4;

export default function RecentRooms() {
  const [rooms, setRooms] = useState<RecentRoom[] | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    // localStorage 는 클라이언트 전용이라 마운트 후 한 번 동기화 (hydration 안전)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRooms(listRooms());
  }, []);

  // SSR/첫 페인트(null) 또는 기록 없음 → 렌더 안 함
  if (!rooms || rooms.length === 0) return null;

  const onForget = (id: string) => {
    forgetRoom(id);
    setRooms((prev) => (prev ? prev.filter((r) => r.id !== id) : prev));
  };

  const visible = showAll ? rooms : rooms.slice(0, INITIAL);

  return (
    <section className="fade-up w-full text-left">
      <h2 className="mb-2 px-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        내 방
      </h2>
      <ul className="flex flex-col gap-2">
        {visible.map((r) => (
          <li
            key={r.id}
            className="lift flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <Link
              href={`/rooms/${r.id}`}
              className="press flex min-w-0 flex-1 items-center gap-2"
            >
              <span className="truncate text-sm font-medium">{r.title}</span>
              {isCreator(r.id) && (
                <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-amber-100 px-2 text-[11px] font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                  관리
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={() => onForget(r.id)}
              aria-label={`${r.title} 목록에서 숨기기`}
              className="press inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      {rooms.length > INITIAL && (
        <div className="mt-2 flex justify-center">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            aria-expanded={showAll}
            className="press inline-flex h-9 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <span>
              {showAll ? '접기' : `더 보기 (+${rooms.length - INITIAL})`}
            </span>
            <span
              aria-hidden
              className={`text-[10px] transition-transform ${showAll ? 'rotate-180' : ''}`}
            >
              ▾
            </span>
          </button>
        </div>
      )}
    </section>
  );
}
