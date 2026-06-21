'use client';

import { useState } from 'react';
import { useEscClose } from './use-esc-close';

// 개설자 방 관리 — 마감일 설정/해제 + 지금 즉시 종료.
// 본질적으로 같은 동작 (deadline 변경) 이라 한 모달에 통합.
export default function DeadlineModal({
  current,
  isLocked,
  onClose,
  onSave,
  onCloseNow,
  busy,
}: {
  current: string | null;
  isLocked: boolean;
  onClose: () => void;
  onSave: (value: string | null) => void;
  onCloseNow: () => void;
  busy?: boolean;
}) {
  const [useDeadline, setUseDeadline] = useState(!!current);
  const [value, setValue] = useState(() => {
    const base = current ? new Date(current) : new Date(Date.now() + 86400000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}T${pad(base.getHours())}:${pad(base.getMinutes())}`;
  });
  const [confirmingClose, setConfirmingClose] = useState(false);

  useEscClose(onClose);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="방 관리"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 dark:bg-zinc-900 sm:rounded-2xl">
        <h3 className="text-base font-semibold">방 관리</h3>

        <div className="mt-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useDeadline}
              onChange={(e) => setUseDeadline(e.target.checked)}
              className="h-5 w-5 rounded border-zinc-300"
            />
            마감일 설정
          </label>
          {useDeadline ? (
            <input
              type="datetime-local"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="mt-3 h-12 w-full rounded-xl border border-zinc-200 bg-white px-3 text-base outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20 dark:focus:ring-zinc-100/20 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-100"
            />
          ) : (
            <p className="mt-2 text-xs text-zinc-500">해제하면 무기한이 됩니다.</p>
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="press h-11 flex-1 rounded-full border border-zinc-300 text-sm disabled:opacity-50 dark:border-zinc-700"
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
            disabled={busy}
            className="press h-11 flex-1 rounded-full bg-zinc-900 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900"
          >
            {busy ? '저장 중…' : '저장'}
          </button>
        </div>

        {/* 진행 중인 방에만 "지금 종료" 보여주기 — 이미 마감된 방엔 의미 없음 */}
        {!isLocked && (
          <div className="mt-5 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            {confirmingClose ? (
              <div className="rounded-xl bg-rose-50 p-3 dark:bg-rose-950/30">
                <p className="text-xs text-rose-700 dark:text-rose-300">
                  지금 종료하면 더 이상 투표할 수 없어요. (나중에 다시 마감일을 미래로 바꿔서 열 수 있어요.)
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmingClose(false)}
                    disabled={busy}
                    className="press h-10 flex-1 rounded-full border border-zinc-300 text-xs disabled:opacity-50 dark:border-zinc-700"
                  >
                    뒤로
                  </button>
                  <button
                    type="button"
                    onClick={onCloseNow}
                    disabled={busy}
                    className="press h-10 flex-1 rounded-full bg-rose-600 text-xs font-semibold text-white disabled:opacity-60 dark:bg-rose-500"
                  >
                    {busy ? '종료 중…' : '방 종료 확정'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingClose(true)}
                className="press inline-flex h-10 items-center gap-1.5 text-xs font-medium text-rose-600 underline underline-offset-2 hover:text-rose-700 dark:text-rose-400"
              >
                🛑 지금 종료 (즉시 마감)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
