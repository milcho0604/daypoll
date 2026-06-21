'use client';

import { formatDateKR } from '@/lib/format';
import EmptyState from '@/components/empty-state';

export interface PersonAvailability {
  id: number;
  nickname: string;
  dates: { dateId: number; date: string }[];
}

// 사람별 뷰 — 참여자별 가능 날짜를 grid 로 정렬, 2줄 미리보기 + chevron 더보기.
export default function PersonList({
  people,
  mePid,
  expanded,
  onToggle,
  preview,
  nonVoterCount,
}: {
  people: PersonAvailability[];
  mePid?: number;
  expanded: Set<number>;
  onToggle: (id: number) => void;
  preview: number;
  nonVoterCount: number;
}) {
  if (people.length === 0) {
    return <EmptyState emoji="🌱" message="아직 첫 표를 기다리는 중이에요" />;
  }
  return (
    <>
      <ul className="mt-3 flex flex-col gap-2">
        {people.map((p) => {
          const isExp = expanded.has(p.id);
          const shown = isExp ? p.dates : p.dates.slice(0, preview);
          return (
            <li
              key={p.id}
              className="lift rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {p.nickname}
                  {mePid === p.id && (
                    <span className="ml-1 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      (나)
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-zinc-500">
                  {p.dates.length}일 가능
                </span>
              </div>
              <ul className="mt-2 grid grid-cols-4 gap-1.5">
                {shown.map((d) => (
                  <li key={d.dateId}>
                    <span className="flex h-7 w-full items-center justify-center whitespace-nowrap rounded-full bg-zinc-100 px-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {formatDateKR(d.date)}
                    </span>
                  </li>
                ))}
              </ul>
              {p.dates.length > preview && (
                <button
                  type="button"
                  onClick={() => onToggle(p.id)}
                  aria-expanded={isExp}
                  aria-label={
                    isExp ? '접기' : `날짜 ${p.dates.length - preview}개 더 보기`
                  }
                  className="press mt-1.5 flex w-full items-center justify-center rounded-lg py-1 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-300"
                >
                  <svg
                    aria-hidden
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`h-4 w-4 transition-transform ${
                      isExp ? 'rotate-180' : ''
                    }`}
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {nonVoterCount > 0 && (
        <p className="mt-2 rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          아직 {nonVoterCount}명이 안 골랐어요
        </p>
      )}
    </>
  );
}
