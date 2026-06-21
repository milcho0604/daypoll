'use client';

import { useState } from 'react';
import { useEscClose } from './use-esc-close';

// PIN 으로 본인 표 복원. 같은 PIN 충돌 시 needsNickname 으로 닉네임도 받음.
export default function RecoverModal({
  onClose,
  onSubmit,
  busy,
  needsNickname,
}: {
  onClose: () => void;
  onSubmit: (pin: string, nickname?: string) => void;
  busy: boolean;
  needsNickname?: boolean;
}) {
  const [nickname, setNickname] = useState('');
  const [pin, setPin] = useState('');
  useEscClose(onClose);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="PIN으로 복원"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!/^\d{4}$/.test(pin)) return;
          if (needsNickname && !nickname.trim()) return;
          onSubmit(pin, needsNickname ? nickname.trim() : undefined);
        }}
        className="w-full max-w-md rounded-t-2xl bg-white p-5 dark:bg-zinc-900 sm:rounded-2xl"
      >
        <h3 className="text-base font-semibold">PIN으로 복원</h3>
        <p className="mt-1 text-xs text-zinc-500">
          {needsNickname
            ? '같은 PIN으로 가입한 친구가 여러 명이에요. 닉네임도 같이 알려주세요.'
            : '이 방에 처음 들어올 때 설정한 PIN으로 본인 표를 되찾아옵니다.'}
        </p>
        <p className="mt-2 text-[11px] text-zinc-400">
          PIN 까먹었으면? 단톡방에서 개설자한테 강퇴 부탁 → 다시 입장하면 돼요.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{4}"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="0000"
            className="h-12 w-32 rounded-xl border border-zinc-200 bg-white px-4 text-base tracking-widest outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20 dark:focus:ring-zinc-100/20 dark:border-zinc-700 dark:bg-zinc-950"
            required
            autoFocus
          />
          {needsNickname && (
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="닉네임"
              maxLength={20}
              className="h-12 rounded-xl border border-zinc-200 bg-white px-4 text-base outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20 dark:focus:ring-zinc-100/20 dark:border-zinc-700 dark:bg-zinc-950"
              required
            />
          )}
        </div>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-full border border-zinc-300 text-sm dark:border-zinc-700"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={busy || pin.length !== 4 || (needsNickname && !nickname.trim())}
            className="h-11 flex-1 rounded-full bg-zinc-900 text-sm font-medium text-white disabled:bg-zinc-300 dark:bg-white dark:text-zinc-900"
          >
            {busy ? '복원 중…' : '복원'}
          </button>
        </div>
      </form>
    </div>
  );
}
