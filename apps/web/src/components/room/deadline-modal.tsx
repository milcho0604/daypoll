'use client';

import { useState } from 'react';
import { useEscClose } from './use-esc-close';

// 개설자 마감일 설정/해제.
export default function DeadlineModal({
  current,
  onClose,
  onSave,
}: {
  current: string | null;
  onClose: () => void;
  onSave: (value: string | null) => void;
}) {
  const [useDeadline, setUseDeadline] = useState(!!current);
  const [value, setValue] = useState(() => {
    const base = current ? new Date(current) : new Date(Date.now() + 86400000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}T${pad(base.getHours())}:${pad(base.getMinutes())}`;
  });

  useEscClose(onClose);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="마감일 수정"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 dark:bg-zinc-900 sm:rounded-2xl">
        <h3 className="text-base font-semibold">마감일 수정</h3>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={useDeadline}
            onChange={(e) => setUseDeadline(e.target.checked)}
            className="h-5 w-5 rounded border-zinc-300"
          />
          마감일 설정
        </label>
        {useDeadline && (
          <input
            type="datetime-local"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="mt-3 h-12 w-full rounded-xl border border-zinc-200 bg-white px-3 text-base outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-100"
          />
        )}
        {!useDeadline && (
          <p className="mt-2 text-xs text-zinc-500">해제하면 무기한이 됩니다.</p>
        )}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-full border border-zinc-300 text-sm dark:border-zinc-700"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => {
              if (!useDeadline) return onSave(null);
              const t = new Date(value).getTime();
              if (Number.isNaN(t)) return; // 빈/잘못된 입력 무시
              onSave(new Date(t).toISOString());
            }}
            className="h-11 flex-1 rounded-full bg-zinc-900 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
