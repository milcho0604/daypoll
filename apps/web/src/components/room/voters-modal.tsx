'use client';

import { useEffect } from 'react';
import type { Voter } from '@whenever/shared';
import { formatDateKR } from '@/lib/format';

// 확정된 날짜를 탭하면 누가 가능했는지 팝업으로.
// CLAUDE.md §4 다이얼로그 패턴 — 모바일 바텀시트 / 데스크탑 카드.
export default function VotersModal({
  open,
  date,
  voters,
  onClose,
}: {
  open: boolean;
  date: string | null;
  voters: Voter[];
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !date) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="voters-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-5 dark:bg-zinc-900 sm:rounded-2xl">
        <div className="flex items-center justify-between gap-2">
          <h2
            id="voters-title"
            className="text-base font-semibold text-zinc-900 dark:text-zinc-100"
          >
            🏆 {formatDateKR(date)} 가능한 친구
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="press inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            ✕
          </button>
        </div>
        {voters.length > 0 ? (
          <ul className="mt-3 flex max-h-72 flex-wrap gap-1.5 overflow-y-auto pr-1">
            {voters.map((v) => (
              <li key={v.id}>
                <span className="inline-flex h-9 items-center rounded-full bg-zinc-100 px-3 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {v.nickname}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            아직 아무도 안 골랐어요
          </p>
        )}
        <p className="mt-4 text-xs text-zinc-400">총 {voters.length}명</p>
      </div>
    </div>
  );
}
