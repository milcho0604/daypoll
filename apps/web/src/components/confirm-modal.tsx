'use client';

import { useEffect, useRef } from 'react';

// 어드민 작업의 native confirm() 을 일관된 모달로 교체.
// CLAUDE.md §1-2 다이얼로그 패턴 + 친근 톤.
export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = '확인',
  cancelLabel = '취소',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  // 진입 시 confirm 버튼에 포커스 (키보드 접근성)
  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  // Esc 키로 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-5 dark:bg-zinc-900 sm:rounded-2xl">
        <h2 id="confirm-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h2>
        {message && (
          <p className="mt-2 whitespace-pre-line text-sm text-zinc-600 dark:text-zinc-400">
            {message}
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="press h-11 flex-1 rounded-xl border border-zinc-200 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`press h-11 flex-1 rounded-xl text-sm font-semibold text-white disabled:opacity-60 ${
              danger
                ? 'bg-rose-600 dark:bg-rose-500'
                : 'bg-zinc-900 dark:bg-white dark:text-zinc-900'
            }`}
          >
            {busy ? '진행 중…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
