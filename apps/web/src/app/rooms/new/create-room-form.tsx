'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError } from '@/lib/api';
import { createRoom } from '@/lib/rooms';
import { writeTokens } from '@/lib/tokens';

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isoToLocalInput(iso: string) {
  // 'YYYY-MM-DDTHH:mm' for <input type="datetime-local">
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CreateRoomForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [dates, setDates] = useState<string[]>([]);
  const [pendingDate, setPendingDate] = useState(todayISO());
  const [useDeadline, setUseDeadline] = useState(false);
  const [deadline, setDeadline] = useState<string>(() => {
    const d = new Date(Date.now() + 7 * 86400000);
    return isoToLocalInput(d.toISOString());
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = title.trim().length > 0 && dates.length > 0 && !submitting;

  const MAX_DATES = 60;

  function addDate() {
    if (!pendingDate) return;
    setDates((prev) =>
      prev.length >= MAX_DATES
        ? prev
        : Array.from(new Set([...prev, pendingDate])).sort(),
    );
  }

  function removeDate(d: string) {
    setDates((prev) => prev.filter((x) => x !== d));
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
        deadline: useDeadline ? new Date(deadline).toISOString() : null,
      });
      writeTokens(res.roomId, { creatorToken: res.creatorToken });
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
    <form onSubmit={onSubmit} className="flex flex-col gap-6 pb-28">
      <section className="flex flex-col gap-2">
        <label htmlFor="title" className="text-sm font-medium">
          제목
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          placeholder="예: 5월 동기 모임"
          className="h-12 rounded-xl border border-zinc-200 bg-white px-4 text-base outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-zinc-100"
          required
        />
      </section>

      <section className="flex flex-col gap-3">
        <label className="text-sm font-medium">후보 날짜</label>
        <div className="flex gap-2">
          <input
            type="date"
            value={pendingDate}
            min={todayISO()}
            onChange={(e) => setPendingDate(e.target.value)}
            className="h-12 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-base outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-zinc-100"
          />
          <button
            type="button"
            onClick={addDate}
            disabled={dates.length >= MAX_DATES}
            className="h-12 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 dark:disabled:bg-zinc-700"
          >
            추가
          </button>
        </div>
        {dates.length === 0 ? (
          <p className="text-xs text-zinc-400">아직 추가된 날짜가 없습니다.</p>
        ) : dates.length >= MAX_DATES ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            최대 {MAX_DATES}개까지 추가할 수 있어요.
          </p>
        ) : null}
        {dates.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {dates.map((d) => (
              <li key={d}>
                <button
                  type="button"
                  onClick={() => removeDate(d)}
                  aria-label={`${d} 제거`}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 text-sm transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                >
                  <span>{d}</span>
                  <span aria-hidden className="text-zinc-400">×</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <label className="inline-flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={useDeadline}
            onChange={(e) => setUseDeadline(e.target.checked)}
            className="h-5 w-5 rounded border-zinc-300"
          />
          마감일 설정 (선택)
        </label>
        {useDeadline && (
          <input
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="h-12 rounded-xl border border-zinc-200 bg-white px-3 text-base outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-zinc-100"
          />
        )}
        {!useDeadline && (
          <p className="text-xs text-zinc-400">설정하지 않으면 무기한입니다.</p>
        )}
      </section>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white/90 px-5 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto w-full max-w-md">
          <button
            type="submit"
            disabled={!canSubmit}
            className="h-12 w-full rounded-full bg-zinc-900 text-base font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-500"
          >
            {submitting ? '만드는 중…' : '만들기'}
          </button>
        </div>
      </div>
    </form>
  );
}
