'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  PLACES_PER_ROOM_MAX,
  REGIONS,
  type RegionCode,
} from '@whenever/shared';
import { ApiError } from '@/lib/api';
import { createRoom } from '@/lib/rooms';
import { writeTokens } from '@/lib/tokens';
import { recordRoom } from '@/lib/recent-rooms';
import DateBuilder from '@/components/date-builder';
import PlaceForm, { type PlaceInput } from '@/components/room/place-form';
import { providerOf, safeHref } from '@/lib/place-share';

function isoToLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const MAX_DATES = 60;

// [0] 은 SSR 이 그리는 고정 힌트 — 나머지는 마운트 후 랜덤으로 갈아끼운다.
const TITLE_HINTS = [
  '팀 회식',
  '주말 등산 ⛰️',
  '대학 친구들',
  '엄마 생신',
  '동기 모임',
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
  const [region, setRegion] = useState<string>('');
  // 장소 후보 미리 넣기 (선택) — 첫 공유 전에 넣어두면 친구들이 첫 방문에 날짜·장소를
  // 한 번에 고른다. 나중에 방에서 누구나 더 올릴 수 있으니 여기선 접어둔다.
  const [places, setPlaces] = useState<PlaceInput[]>([]);
  const [placesOpen, setPlacesOpen] = useState(false);
  // 렌더 중에 랜덤을 뽑으면 서버 HTML 과 클라이언트가 다른 힌트를 그려 hydration mismatch 가 난다.
  // SSR 은 항상 [0] 을 그리고, 마운트된 뒤에만 랜덤으로 바꾼다.
  const [titleHint, setTitleHint] = useState(TITLE_HINTS[0]);
  useEffect(() => {
    // 마운트 1회뿐이고 placeholder 문구만 바꿔서 cascading render 비용이 없다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTitleHint(TITLE_HINTS[Math.floor(Math.random() * TITLE_HINTS.length)]);
  }, []);
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
        region: (region as RegionCode) || null,
        places: places.length
          ? places.map((p) => ({
              name: p.name.trim(),
              url: p.url.trim() || null,
              memo: p.memo.trim() || null,
            }))
          : undefined,
      });
      writeTokens(res.roomId, { creatorToken: res.creatorToken });
      recordRoom(res.roomId, title.trim());
      // 방장이 'by 닉네임' 을 넣었으면 투표 입장 폼 닉네임으로 자동 채워준다 (재입력 0).
      if (createdBy.trim()) {
        window.localStorage.setItem('whenever_last_nickname', createdBy.trim());
      }
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
          className="h-12 rounded-xl border border-zinc-200 bg-white px-4 text-base outline-none transition-colors focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-zinc-100"
          required
        />
        <input
          id="createdBy"
          type="text"
          value={createdBy}
          onChange={(e) => setCreatedBy(e.target.value)}
          maxLength={20}
          placeholder="내 닉네임 (선택)"
          className="h-12 rounded-xl border border-zinc-200 bg-white px-4 text-base outline-none transition-colors focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-zinc-100"
        />
        <p className="text-xs text-zinc-500">
          넣어두면 친구한테 &ldquo;by 닉네임&rdquo; 으로 누가 만든 모임인지 표시돼요.
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
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            최대 {MAX_DATES}개까지 추가할 수 있어요.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <label className="text-sm font-medium">
            장소·메뉴도 같이 정할래요? <span className="text-zinc-400">·</span>
            <span className="ml-1 text-xs font-normal text-zinc-500">선택</span>
          </label>
          <p className="mt-0.5 break-keep text-xs text-zinc-500">
            후보를 넣어두면 친구들이 날짜랑 같이 골라요. 방에서 누구나 더 올릴 수도 있어요.
          </p>
        </div>
        {places.length > 0 && (
          <ul className="flex flex-col gap-2">
            {places.map((p, i) => {
              const href = safeHref(p.url);
              return (
                <li
                  key={`${p.name}-${i}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">📍 {p.name}</p>
                    {(href || p.memo.trim()) && (
                      <p className="truncate text-xs text-zinc-500">
                        {[href ? providerOf(href)?.label : null, p.memo.trim() || null]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPlaces((prev) => prev.filter((_, j) => j !== i))}
                    aria-label={`${p.name} 빼기`}
                    className="press inline-flex h-9 shrink-0 items-center rounded-full px-3 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-rose-600 dark:hover:bg-zinc-800"
                  >
                    빼기
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {placesOpen ? (
          places.length < PLACES_PER_ROOM_MAX && (
            <PlaceForm
              compact
              submitLabel="후보에 넣기"
              busyLabel="넣는 중…"
              onCancel={() => setPlacesOpen(false)}
              onSubmit={async (input) => {
                const name = input.name.trim();
                if (places.some((p) => p.name.trim().toLowerCase() === name.toLowerCase())) {
                  return '이미 같은 이름의 후보가 있어요.';
                }
                if (input.url.trim() && !safeHref(input.url.trim())) {
                  return '링크가 이상해요. https:// 로 시작하는 주소를 넣어주세요.';
                }
                setPlaces((prev) => [...prev, input]);
                return null;
              }}
            />
          )
        ) : (
          <button
            type="button"
            onClick={() => setPlacesOpen(true)}
            className="press flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-300 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <span aria-hidden>＋</span>
            {places.length > 0 ? '후보 더 넣기' : '장소 후보 넣기'}
          </button>
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
              className="press h-9 rounded-full border border-zinc-200 bg-white px-3 text-xs font-medium transition-colors hover:border-zinc-900 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-100 dark:hover:bg-zinc-800"
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
            className="h-12 rounded-xl border border-zinc-200 bg-white px-3 text-base outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-zinc-100"
          />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <label htmlFor="region" className="text-sm font-medium">
            어느 지역이에요? <span className="text-zinc-400">·</span>
            <span className="ml-1 text-xs font-normal text-zinc-500">날씨 (선택)</span>
          </label>
          <p className="mt-0.5 text-xs text-zinc-500">
            고르면 후보 날짜에 날씨를 같이 보여줘요. 가까운 날짜만 나와요.
          </p>
        </div>
        {/* appearance-none + 직접 그린 화살표 — OS 기본 화살표는 rounded 모서리에
            잘리거나 안 보여서 "목록인지 모르겠다"는 피드백. pr-10 으로 공간 확보. */}
        <div className="relative">
          <select
            id="region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="h-12 w-full appearance-none rounded-xl border border-zinc-200 bg-white pl-3 pr-10 text-base outline-none transition-colors focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-zinc-100"
          >
            <option value="">날씨 안 볼래요</option>
            {REGIONS.map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
              </option>
            ))}
          </select>
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
          >
            <path d="m5 8 5 5 5-5" />
          </svg>
        </div>
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
