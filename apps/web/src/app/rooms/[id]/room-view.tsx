'use client';

import type { DateResult, RoomDetail } from '@whenever/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '@/lib/api';
import {
  getMe,
  getResults,
  getRoom,
  joinRoom,
  kickParticipant,
  recoverParticipant,
  updateAvailabilities,
  updateDeadline,
} from '@/lib/rooms';
import { readTokens, writeTokens } from '@/lib/tokens';

const POLL_INTERVAL_MS = 4000;

type Me = { participantId: number; nickname: string; dateIds: number[] };

export default function RoomView({
  roomId,
  initial,
}: {
  roomId: string;
  initial: RoomDetail;
}) {
  const [room, setRoom] = useState<RoomDetail>(initial);
  const [creatorToken, setCreatorToken] = useState<string | undefined>(undefined);
  const [clientToken, setClientToken] = useState<string | undefined>(undefined);
  const [me, setMe] = useState<Me | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [nickname, setNickname] = useState('');
  const [usePin, setUsePin] = useState(false);
  const [pin, setPin] = useState('');
  const [showRecover, setShowRecover] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [showDeadlineModal, setShowDeadlineModal] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isLocked = !!room.deadline && new Date(room.deadline).getTime() <= now;
  const isCreator = !!creatorToken;

  // 토큰 복원
  useEffect(() => {
    const t = readTokens(roomId);
    setCreatorToken(t.creatorToken);
    setClientToken(t.clientToken);
  }, [roomId]);

  // 내 표 정보 로드
  useEffect(() => {
    if (!clientToken) return;
    let cancelled = false;
    (async () => {
      try {
        const m = await getMe(roomId, clientToken);
        if (cancelled) return;
        if (m) {
          setMe(m);
          setSelected(new Set(m.dateIds));
        } else {
          // 토큰이 서버에 없는 경우 (예: 방 초기화) → 닉네임 다시 받기
          setMe(null);
          setClientToken(undefined);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientToken, roomId]);

  // 폴링 (결과 + 마감 갱신)
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await getResults(roomId);
        if (!cancelled) {
          setRoom((prev) => ({
            ...prev,
            results: r.results,
            participantCount: r.participantCount,
            deadline: r.deadline,
          }));
          setNow(Date.now());
        }
      } catch {
        /* silent */
      }
    };
    const id = setInterval(tick, POLL_INTERVAL_MS);
    pollingRef.current = id;
    // 페이지 가시성 변할 때 즉시 한 번
    const onVisible = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [roomId]);

  // D-day 1초마다 갱신 (마감 임박 표시용)
  useEffect(() => {
    if (!room.deadline) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [room.deadline]);

  const sortedResults = useMemo<DateResult[]>(() => {
    return [...room.results].sort((a, b) => {
      if (b.votes !== a.votes) return b.votes - a.votes;
      return a.date.localeCompare(b.date);
    });
  }, [room.results]);

  const maxVotes = sortedResults.reduce((m, r) => Math.max(m, r.votes), 0);

  const toggle = (id: number) => {
    if (isLocked || !clientToken) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  async function onJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!nickname.trim()) return;
    if (usePin && !/^\d{4}$/.test(pin)) {
      setError('PIN은 4자리 숫자여야 합니다.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await joinRoom(roomId, {
        nickname: nickname.trim(),
        pin: usePin ? pin : undefined,
      });
      writeTokens(roomId, { clientToken: r.clientToken });
      setClientToken(r.clientToken);
      setMe({ participantId: r.participantId, nickname: nickname.trim(), dateIds: [] });
      setSelected(new Set());
      // 즉시 결과 한 번 갱신 (참여자 수 반영)
      const res = await getResults(roomId);
      setRoom((prev) => ({
        ...prev,
        results: res.results,
        participantCount: res.participantCount,
      }));
    } catch (err) {
      setError(extractMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function onSaveVotes() {
    if (!clientToken) return;
    setBusy(true);
    setError(null);
    try {
      await updateAvailabilities(roomId, clientToken, {
        dateIds: Array.from(selected),
      });
      setSavedAt(Date.now());
      const res = await getResults(roomId);
      setRoom((prev) => ({
        ...prev,
        results: res.results,
        participantCount: res.participantCount,
      }));
    } catch (err) {
      setError(extractMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function onRecover(nickname: string, pin: string) {
    setBusy(true);
    setError(null);
    try {
      const r = await recoverParticipant(roomId, { nickname, pin });
      writeTokens(roomId, { clientToken: r.clientToken });
      setClientToken(r.clientToken);
      setShowRecover(false);
      const m = await getMe(roomId, r.clientToken);
      setMe(m);
      setSelected(new Set(m?.dateIds ?? []));
    } catch (err) {
      setError(extractMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function onKick(participantId: number, nickname: string) {
    if (!creatorToken) return;
    if (!confirm(`${nickname} 을 방에서 내보낼까요? 표도 같이 사라집니다.`)) return;
    setBusy(true);
    setError(null);
    try {
      await kickParticipant(roomId, creatorToken, participantId);
      const fresh = await getRoom(roomId);
      setRoom(fresh);
    } catch (err) {
      setError(extractMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function onSaveDeadline(value: string | null) {
    if (!creatorToken) return;
    setBusy(true);
    setError(null);
    try {
      const r = await updateDeadline(roomId, creatorToken, { deadline: value });
      setRoom((prev) => ({ ...prev, deadline: r.deadline }));
      setShowDeadlineModal(false);
      // 마감일 바뀐 직후 결과/방 정보 동기화
      const fresh = await getRoom(roomId);
      setRoom(fresh);
    } catch (err) {
      setError(extractMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 pb-32 pt-6 sm:pt-10">
      <header className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">{room.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
          <span>참여자 {room.participantCount}명</span>
          <span aria-hidden>·</span>
          <DeadlineLabel deadline={room.deadline} now={now} />
          {isCreator && (
            <>
              <span aria-hidden>·</span>
              <button
                type="button"
                onClick={() => setShowDeadlineModal(true)}
                className="text-xs underline underline-offset-2 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                마감일 수정
              </button>
            </>
          )}
        </div>
      </header>

      {!clientToken ? (
        <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-base font-semibold">닉네임 입력</h2>
          <p className="mt-1 text-sm text-zinc-500">방에서 너를 어떻게 부를지 정해줘.</p>
          <form onSubmit={onJoin} className="mt-4 flex flex-col gap-3">
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="예: 민철"
              maxLength={20}
              className="h-12 rounded-xl border border-zinc-200 bg-white px-4 text-base outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-100"
              required
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={usePin}
                onChange={(e) => setUsePin(e.target.checked)}
                className="h-5 w-5 rounded border-zinc-300"
              />
              4자리 PIN 설정 (다른 기기에서 같은 사람으로 복원하고 싶을 때)
            </label>
            {usePin && (
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{4}"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="0000"
                className="h-12 w-32 rounded-xl border border-zinc-200 bg-white px-4 text-base tracking-widest outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-100"
              />
            )}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowRecover(true)}
                className="text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                다른 기기에서 들어왔어요 (PIN 복원)
              </button>
              <button
                type="submit"
                disabled={busy || !nickname.trim() || (usePin && pin.length !== 4)}
                className="h-12 rounded-xl bg-zinc-900 px-5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-white dark:text-zinc-900 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-500"
              >
                들어가기
              </button>
            </div>
          </form>
        </section>
      ) : (
        <section className="mt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">가능한 날짜 선택</h2>
            {me && (
              <span className="text-xs text-zinc-500">{me.nickname}으로 참여 중</span>
            )}
          </div>
          {isLocked && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              투표가 마감되었습니다. 결과만 확인할 수 있어요.
            </p>
          )}
          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {room.dates.map((d) => {
              const checked = selected.has(d.id);
              return (
                <li key={d.id}>
                  <label
                    className={`flex h-14 cursor-pointer items-center justify-center rounded-xl border text-sm font-medium transition-colors ${
                      checked
                        ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900'
                        : 'border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900'
                    } ${isLocked ? 'opacity-60 pointer-events-none' : ''}`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() => toggle(d.id)}
                      disabled={isLocked}
                    />
                    {formatDateKR(d.date)}
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-base font-semibold">실시간 순위</h2>
        {sortedResults.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">아직 결과가 없습니다.</p>
        ) : (
          <ol className="mt-3 flex flex-col gap-2">
            {sortedResults.map((r, idx) => (
              <li
                key={r.dateId}
                className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        idx === 0
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                          : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-sm font-medium">{formatDateKR(r.date)}</span>
                  </div>
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    {r.votes}표
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className="h-full bg-zinc-900 transition-all dark:bg-zinc-100"
                    style={{
                      width: `${maxVotes ? (r.votes / maxVotes) * 100 : 0}%`,
                    }}
                  />
                </div>
                {r.voters && r.voters.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1">
                    {r.voters.map((v) => (
                      <li key={v.id}>
                        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                          {v.nickname}
                          {isCreator && (
                            <button
                              type="button"
                              onClick={() => onKick(v.id, v.nickname)}
                              aria-label={`${v.nickname} 강퇴`}
                              className="ml-0.5 text-zinc-400 hover:text-red-600"
                            >
                              ×
                            </button>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {clientToken && !isLocked && (
        <div className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white/95 px-5 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
          <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3">
            <span className="text-xs text-zinc-500">
              {savedAt
                ? '저장됨'
                : `${selected.size}개 선택`}
            </span>
            <button
              type="button"
              onClick={onSaveVotes}
              disabled={busy}
              className="h-12 flex-1 max-w-xs rounded-full bg-zinc-900 text-base font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-white dark:text-zinc-900 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-500"
            >
              {busy ? '저장 중…' : '저장'}
            </button>
          </div>
        </div>
      )}

      {showDeadlineModal && (
        <DeadlineModal
          current={room.deadline}
          onClose={() => setShowDeadlineModal(false)}
          onSave={onSaveDeadline}
        />
      )}

      {showRecover && (
        <RecoverModal
          onClose={() => setShowRecover(false)}
          onSubmit={onRecover}
          busy={busy}
        />
      )}
    </main>
  );
}

function RecoverModal({
  onClose,
  onSubmit,
  busy,
}: {
  onClose: () => void;
  onSubmit: (nickname: string, pin: string) => void;
  busy: boolean;
}) {
  const [nickname, setNickname] = useState('');
  const [pin, setPin] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (nickname.trim() && /^\d{4}$/.test(pin)) onSubmit(nickname.trim(), pin);
        }}
        className="w-full max-w-md rounded-t-2xl bg-white p-5 dark:bg-zinc-900 sm:rounded-2xl"
      >
        <h3 className="text-base font-semibold">PIN 으로 복원</h3>
        <p className="mt-1 text-xs text-zinc-500">
          이 방에 처음 들어올 때 닉네임과 함께 설정한 PIN으로 본인 표를 되찾아옵니다.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="닉네임"
            maxLength={20}
            className="h-12 rounded-xl border border-zinc-200 bg-white px-4 text-base dark:border-zinc-700 dark:bg-zinc-950"
            required
          />
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{4}"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="0000"
            className="h-12 w-32 rounded-xl border border-zinc-200 bg-white px-4 text-base tracking-widest dark:border-zinc-700 dark:bg-zinc-950"
            required
          />
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
            disabled={busy || !nickname.trim() || pin.length !== 4}
            className="h-11 flex-1 rounded-full bg-zinc-900 text-sm font-medium text-white disabled:bg-zinc-300 dark:bg-white dark:text-zinc-900"
          >
            {busy ? '복원 중…' : '복원'}
          </button>
        </div>
      </form>
    </div>
  );
}

function DeadlineLabel({ deadline, now }: { deadline: string | null; now: number }) {
  if (!deadline) return <span>마감 없음</span>;
  const ms = new Date(deadline).getTime() - now;
  if (ms <= 0) return <span className="text-amber-600 dark:text-amber-300">마감됨</span>;
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return <span>D-{days}</span>;
  if (hours > 0) return <span>{hours}시간 후 마감</span>;
  return <span>{minutes}분 후 마감</span>;
}

function DeadlineModal({
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
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
            onClick={() => onSave(useDeadline ? new Date(value).toISOString() : null)}
            className="h-11 flex-1 rounded-full bg-zinc-900 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDateKR(iso: string) {
  // 'YYYY-MM-DD' → 'M/D (요일)'
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][dt.getDay()];
  return `${m}/${d} (${weekday})`;
}

function extractMsg(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 423) return '투표가 마감되었습니다.';
    if (typeof err.payload === 'object' && err.payload && 'message' in err.payload) {
      const m = (err.payload as { message: unknown }).message;
      return Array.isArray(m) ? m.join(', ') : String(m);
    }
    return `API ${err.status}`;
  }
  return (err as Error).message;
}
