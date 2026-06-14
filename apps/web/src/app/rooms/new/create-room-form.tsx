'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError } from '@/lib/api';
import { createRoom } from '@/lib/rooms';
import { writeTokens } from '@/lib/tokens';
import { recordRoom } from '@/lib/recent-rooms';
import DateBuilder from '@/components/date-builder';

function isoToLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const MAX_DATES = 60;

const TITLE_HINTS = [
  '5월 동기 모임',
  '주말 등산 ⛰️',
  '팀 회식',
  '대학 친구들',
  '엄마 생신',
];

const DEADLINE_PRESETS = [
  { label: '3일 뒤', days: 3 },
  { label: '일주일 뒤', days: 7 },
  { label: '2주 뒤', days: 14 },
];

export default function CreateRoomForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [createdBy, setCreatedBy] = useState('');
  const [dates, setDates] = useState<string[]>([]);
  const [useDeadline, setUseDeadline] = useState(false);
  const [deadline, setDeadline] = useState<string>('');
  const [titleHint] = useState(() => TITLE_HINTS[Math.floor(Math.random() * TITLE_HINTS.length)]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = title.trim().length > 0 && dates.length > 0 && !submitting;

  function applyPreset(days: number) {
    // event handler 라 render 단계 아님 — 규칙 오탐
    // eslint-disable-next-line react-hooks/purity
    const d = new Date(Date.now() + days * 86400000);
    d.setHours(23, 59, 0, 0);
    setUseDeadline(true);
    setDeadline(isoToLocalInput(d));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await createRoom({
        title: title.trim(),
        dates,
        deadline: useDeadline && deadline ? new Date(deadline).toISOString() : null,
        createdBy: createdBy.trim() || undefined,
      });
      writeTokens(res.roomId, { creatorToken: res.creatorToken });
      recordRoom(res.roomId, title.trim());
      router.push(`/rooms/${res.roomId}/created`);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? typeof err.payload === 'object' && err.payload && 'message' in err.payload
            ? String((err.payload as { message: unknown }).message)
            : `API ${err.status}`
          : (err as Error).message;
      setError(msg);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-7 pb-28">
      <section className="flex flex-col gap-2">
        <label htmlFor="title" className="text-sm font-medium">
          어떤 모임이에요? <span className="text-zinc-400">·</span>
          <span className="ml-1 text-xs font-normal text-zinc-500">제목</span>
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          placeholder={`예: ${titleHint}`}
          className="h-12 rounded-xl border border-zinc-200 bg-white px-4 text-base outline-none transition-colors focus:border-amber-500 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-amber-400"
          required
        />
        <input
          id="createdBy"
          type="text"
          value={createdBy}
          onChange={(e) => setCreatedBy(e.target.value)}
          maxLength={20}
          placeholder="내 닉네임 (선택)"
          className="h-12 rounded-xl border border-zinc-200 bg-white px-4 text-base outline-none transition-colors focus:border-amber-500 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-amber-400"
        />
        <p className="text-xs text-zinc-500">
          넣어두면 친구한테 "by 닉네임" 으로 누가 만든 모임인지 표시돼요.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <label className="text-sm font-medium">가능한 날짜 후보</label>
          <p className="mt-0.5 text-xs text-zinc-500">
            친구들이 이 안에서 가능한 날을 골라요.
          </p>
        </div>
        <DateBuilder values={dates} onChange={setDates} max={MAX_DATES} />
        {dates.length >= MAX_DATES && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            최대 {MAX_DATES}개까지 추가할 수 있어요.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <label className="text-sm font-medium">언제까지 받을까요?</label>
          <p className="mt-0.5 text-xs text-zinc-500">
            마감 후엔 투표가 잠겨요. 비워두면 무기한.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {DEADLINE_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p.days)}
              className="press h-9 rounded-full border border-zinc-200 bg-white px-3 text-xs font-medium transition-colors hover:border-amber-500 hover:bg-amber-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-amber-400 dark:hover:bg-amber-950/30"
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setUseDeadline(false);
              setDeadline('');
            }}
            className={`press h-9 rounded-full border px-3 text-xs font-medium transition-colors ${
              !useDeadline
                ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900'
                : 'border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900'
            }`}
          >
            무기한
          </button>
        </div>
        {useDeadline && (
          <input
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="h-12 rounded-xl border border-zinc-200 bg-white px-3 text-base outline-none focus:border-amber-500 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-amber-400"
          />
        )}
      </section>

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="mx-auto w-full max-w-md">
          <button
            type="submit"
            disabled={!canSubmit}
            className="press h-12 w-full rounded-full bg-zinc-900 text-base font-semibold text-white shadow-md shadow-zinc-900/20 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:shadow-none dark:bg-white dark:text-zinc-900 dark:shadow-white/10 dark:hover:bg-zinc-200 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-500"
          >
            {submitting ? '만드는 중…' : title.trim() && dates.length > 0 ? `만들고 링크 받기` : '제목과 날짜를 채워주세요'}
          </button>
        </div>
      </div>
    </form>
  );
}
