'use client';

import type { DateResult, RoomDetail } from '@whenever/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiBaseUrl, ApiError } from '@/lib/api';
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
import { getSocket, joinRoomChannel, leaveRoomChannel } from '@/lib/socket';
import { readTokens, writeTokens } from '@/lib/tokens';
import DateAvailabilityPicker from '@/components/date-availability-picker';
import EmptyState from '@/components/empty-state';

const POLL_INTERVAL_MS_DEFAULT = 4000;
const POLL_INTERVAL_MS_WHEN_LIVE = 30000; // 소켓 살아있으면 백업용 폴링은 느리게

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
  // 이전에 다른 방에서 쓴 닉네임을 자동 채워준다 (재방문 마찰 0).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const last = window.localStorage.getItem('whenever_last_nickname');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (last) setNickname(last);
  }, []);
  const [usePin, setUsePin] = useState(false);
  const [pin, setPin] = useState('');
  const [showRecover, setShowRecover] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<
    'idle' | 'pending' | 'saving' | 'saved' | 'error'
  >('idle');
  const [showDeadlineModal, setShowDeadlineModal] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [live, setLive] = useState(false);
  const [showAllResults, setShowAllResults] = useState(false);
  const [meLoading, setMeLoading] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [resultsCopied, setResultsCopied] = useState(false);
  const [expandedDates, setExpandedDates] = useState<Set<number>>(new Set());
  const [kickTarget, setKickTarget] = useState<{
    id: number;
    nickname: string;
  } | null>(null);
  // 토글 직후 저장 확정 전까지 폴링이 낙관적 표시를 덮어쓰지 않게 막는 플래그
  const dirtyRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const RESULTS_PREVIEW = 5;

  const isLocked = !!room.deadline && new Date(room.deadline).getTime() <= now;
  const isCreator = !!creatorToken;

  // 토큰 복원
  useEffect(() => {
    // 토큰은 localStorage(클라이언트 전용)라 마운트 시 동기화한다.
    const t = readTokens(roomId);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCreatorToken(t.creatorToken);
    setClientToken(t.clientToken);
    // 재방문 참여자 — getMe 로드 동안 가입 폼이 깜빡 보이지 않게 스켈레톤으로
    if (t.clientToken) setMeLoading(true);
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
      if (!cancelled) setMeLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientToken, roomId]);

  // 결과/마감 동기화 — 소켓 push 와 폴링 fallback 이 공용으로 사용
  const tick = useCallback(async () => {
    if (dirtyRef.current) return; // 저장 확정 전엔 낙관적 표시 유지
    try {
      const r = await getResults(roomId);
      setRoom((prev) => ({
        ...prev,
        results: r.results,
        participantCount: r.participantCount,
        deadline: r.deadline,
      }));
      setNow(Date.now());
    } catch {
      /* silent */
    }
  }, [roomId]);

  // 소켓 구독 — roomId 당 1회 join/leave (연결 토글마다 재구독하지 않게 폴링과 분리)
  useEffect(() => {
    const socket = getSocket();
    const onConnect = () => {
      setLive(true);
      joinRoomChannel(roomId);
    };
    const onDisconnect = () => setLive(false);
    const onResults = () => void tick();
    const onDeadline = (payload: { deadline: string | null }) => {
      setRoom((prev) => ({ ...prev, deadline: payload.deadline }));
      setNow(Date.now());
    };
    const onDeleted = () => {
      // 방이 어드민에 의해 삭제됨 — 홈으로 보낼지, 토스트로 알릴지. 일단 페이지 새로고침.
      window.location.reload();
    };

    if (socket.connected) onConnect();
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:results_updated', onResults);
    socket.on('room:deadline_updated', onDeadline);
    socket.on('room:deleted', onDeleted);

    // 첫 페인트가 ISR 캐시(최대 30초 묵음)일 수 있어 마운트 직후 한 번 동기화.
    // tick 은 async — setState 는 fetch 응답 후에만 일어나 cascading render 아님.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void tick();

    const onVisible = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:results_updated', onResults);
      socket.off('room:deadline_updated', onDeadline);
      socket.off('room:deleted', onDeleted);
      leaveRoomChannel(roomId);
    };
  }, [roomId, tick]);

  // 폴링 — 소켓 살아있으면 30초 백업, 끊기면 4초
  useEffect(() => {
    const id = setInterval(
      () => void tick(),
      live ? POLL_INTERVAL_MS_WHEN_LIVE : POLL_INTERVAL_MS_DEFAULT,
    );
    return () => clearInterval(id);
  }, [live, tick]);

  // 언마운트 시 대기 중인 자동 저장 타이머 정리
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

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
    const next = new Set(selected);
    const adding = !next.has(id);
    if (adding) next.add(id);
    else next.delete(id);
    setSelected(next);

    // 낙관적 순위 반영 — 토글 즉시 막대가 움직이고, 확정값은 저장 후 서버 동기화로 교정
    if (me) {
      const mine = { id: me.participantId, nickname: me.nickname };
      setRoom((prev) => ({
        ...prev,
        results: prev.results.map((r) => {
          if (r.dateId !== id) return r;
          const others = (r.voters ?? []).filter((v) => v.id !== mine.id);
          const voters = adding ? [...others, mine] : others;
          return { ...r, voters, votes: voters.length };
        }),
      }));
    }
    scheduleSave(next);
  };

  const toggleExpanded = (dateId: number) =>
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateId)) next.delete(dateId);
      else next.add(dateId);
      return next;
    });

  // 토글 후 600ms 디바운스 자동 저장 — "저장 버튼 누르기" 단계 제거
  const scheduleSave = (dateIds: Set<number>) => {
    dirtyRef.current = true;
    setSaveState('pending');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => void saveVotes(dateIds), 600);
  };

  async function saveVotes(dateIds: Set<number>) {
    if (!clientToken) return;
    setSaveState('saving');
    setError(null);
    try {
      await updateAvailabilities(roomId, clientToken, {
        dateIds: Array.from(dateIds),
      });
      dirtyRef.current = false;
      setSaveState('saved');
      const res = await getResults(roomId);
      setRoom((prev) => ({
        ...prev,
        results: res.results,
        participantCount: res.participantCount,
        deadline: res.deadline,
      }));
    } catch (err) {
      setSaveState('error');
      setError(extractMsg(err));
    }
  }

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
      // 다음 방 진입 때 자동 채워주기
      window.localStorage.setItem('whenever_last_nickname', nickname.trim());
      setClientToken(r.clientToken);
      setMe({ participantId: r.participantId, nickname: nickname.trim(), dateIds: [] });
      setSelected(new Set());
      void tick(); // 참여자 수 즉시 반영
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

  async function confirmKick() {
    if (!creatorToken || !kickTarget) return;
    setBusy(true);
    setError(null);
    try {
      await kickParticipant(roomId, creatorToken, kickTarget.id);
      setKickTarget(null);
      const fresh = await getRoom(roomId);
      setRoom(fresh);
    } catch (err) {
      setError(extractMsg(err));
    } finally {
      setBusy(false);
    }
  }

  // 방 화면에서 바로 재공유 — 단톡방 재전파 동선
  async function shareRoom() {
    const url = window.location.href;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: room.title, url });
        return;
      } catch {
        /* 공유 시트 취소 — 클립보드 fallback 으로 */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      setError('링크 복사가 안 됐어요. 주소창에서 직접 복사해주세요.');
    }
  }

  // 단톡방에 붙여넣을 결과 요약 텍스트
  async function copyResults() {
    const lines = [`📊 ${room.title}`];
    sortedResults.slice(0, 3).forEach((r, i) => {
      if (r.votes === 0) return;
      lines.push(
        `${i === 0 ? '🏆 ' : ''}${i + 1}위 ${formatDateKR(r.date)} — ${r.votes}표`,
      );
    });
    lines.push(`참여 ${room.participantCount}명`, '', window.location.href);
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setResultsCopied(true);
      setTimeout(() => setResultsCopied(false), 2000);
    } catch {
      setError('복사가 안 됐어요. 다시 시도해주세요.');
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
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{room.title}</h1>
          <button
            type="button"
            onClick={() => void shareRoom()}
            className="press inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-zinc-100 px-3.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          >
            {linkCopied ? '복사됨 ✓' : '🔗 링크 복사'}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1">
            <span
              aria-hidden
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                live ? 'bg-emerald-500' : 'bg-zinc-400'
              }`}
            />
            <span className="text-xs">{live ? 'LIVE' : 'polling'}</span>
          </span>
          <span aria-hidden>·</span>
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

      {meLoading ? (
        /* 재방문 참여자 — 내 표 로드 중 가입 폼이 깜빡 보이지 않게 스켈레톤 */
        <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex animate-pulse flex-col gap-3">
            <div className="h-5 w-44 rounded bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
          </div>
        </section>
      ) : !clientToken ? (
        <section className="fade-up mt-4 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-base font-semibold">반가워요 👋</h2>
          <p className="mt-1 text-sm text-zinc-500">
            친구들이 당신을 뭐라고 부를까요?
          </p>
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
        <section className="mt-4 fade-up">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">가능한 날짜를 골라주세요</h2>
            {me && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <span aria-hidden>·</span>
                {me.nickname}
              </span>
            )}
          </div>
          {isLocked && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              투표가 마감되었습니다. 결과만 확인할 수 있어요.
            </p>
          )}
          <DateAvailabilityPicker
            candidates={room.dates}
            selectedIds={selected}
            onToggle={toggle}
            disabled={isLocked}
          />
        </section>
      )}

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">실시간 순위</h2>
          {sortedResults.length > 0 && sortedResults[0].votes > 0 && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void copyResults()}
                className="press text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                {resultsCopied ? '복사됨 ✓' : '결과 복사'}
              </button>
              <a
                href={`${apiBaseUrl}/rooms/${roomId}/winner.ics`}
                className="press text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                1위 캘린더에 담기 (.ics)
              </a>
            </div>
          )}
        </div>
        {sortedResults.length === 0 ? (
          <EmptyState emoji="🌱" message="아직 첫 표를 기다리는 중이에요" />
        ) : (
          <ol className="mt-3 flex flex-col gap-2">
            {(showAllResults
              ? sortedResults
              : sortedResults.slice(0, RESULTS_PREVIEW)
            ).map((r, idx) => (
              <li
                key={r.dateId}
                className={`lift overflow-hidden rounded-xl border bg-white transition-colors dark:bg-zinc-900 ${
                  idx === 0 && r.votes > 0
                    ? 'border-amber-300 ring-1 ring-amber-200/60 dark:border-amber-700 dark:ring-amber-900/60'
                    : 'border-zinc-200 dark:border-zinc-800'
                }`}
              >
                {/* 행 전체 탭 → 누가 투표했는지 펼침 */}
                <button
                  type="button"
                  onClick={() => toggleExpanded(r.dateId)}
                  aria-expanded={expandedDates.has(r.dateId)}
                  className="press w-full p-3 text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {idx === 0 && r.votes > 0 ? (
                        // 이모지 글리프가 박스 위쪽으로 치우치는 경향 — leading-none + pt 미세 보정으로 광학적 정렬.
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-[15px] leading-none shadow-sm">
                          <span className="block translate-y-[0.5px]">🏆</span>
                        </span>
                      ) : (
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold leading-none text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          {idx + 1}
                        </span>
                      )}
                      <span className="text-sm font-medium">
                        {formatDateKR(r.date)}
                      </span>
                      {clientToken && selected.has(r.dateId) && (
                        <span
                          title="내가 고른 날"
                          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                        />
                      )}
                    </div>
                    <span className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                      <span>
                        <strong className="text-zinc-900 dark:text-zinc-100">
                          {r.votes}
                        </strong>
                        표
                      </span>
                      <span
                        aria-hidden
                        className={`text-[10px] text-zinc-400 transition-transform ${
                          expandedDates.has(r.dateId) ? 'rotate-180' : ''
                        }`}
                      >
                        ▾
                      </span>
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className={`h-full transition-all duration-500 ${
                        idx === 0 && r.votes > 0
                          ? 'bg-gradient-to-r from-amber-400 to-amber-600'
                          : 'bg-zinc-900 dark:bg-zinc-100'
                      }`}
                      style={{
                        width: `${maxVotes ? (r.votes / maxVotes) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </button>
                {expandedDates.has(r.dateId) && (
                  <div className="px-3 pb-3">
                    {r.voters && r.voters.length > 0 ? (
                      <ul className="flex flex-wrap gap-1">
                        {r.voters.map((v) => (
                          <li key={v.id}>
                            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                              {v.nickname}
                              {isCreator && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setKickTarget({
                                      id: v.id,
                                      nickname: v.nickname,
                                    })
                                  }
                                  aria-label={`${v.nickname} 내보내기`}
                                  className="press ml-0.5 text-zinc-400 hover:text-rose-600"
                                >
                                  ×
                                </button>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-zinc-400">
                        아직 아무도 안 골랐어요
                      </p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
        {sortedResults.length > RESULTS_PREVIEW && (
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={() => setShowAllResults((v) => !v)}
              aria-expanded={showAllResults}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <span>
                {showAllResults
                  ? '접기'
                  : `더 보기 (+${sortedResults.length - RESULTS_PREVIEW})`}
              </span>
              <span
                aria-hidden
                className={`text-[10px] transition-transform ${
                  showAllResults ? 'rotate-180' : ''
                }`}
              >
                ▾
              </span>
            </button>
          </div>
        )}
      </section>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {clientToken && !isLocked && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
          <div className="mx-auto flex h-10 w-full max-w-2xl items-center justify-between gap-3">
            <span className="text-xs text-zinc-500">{selected.size}개 선택</span>
            {saveState === 'error' ? (
              <button
                type="button"
                onClick={() => void saveVotes(selected)}
                className="press h-10 rounded-full bg-rose-50 px-4 text-sm font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
              >
                저장 실패 — 다시 시도
              </button>
            ) : (
              <span
                className={`text-sm ${
                  saveState === 'saved'
                    ? 'font-medium text-emerald-600 dark:text-emerald-400'
                    : 'text-zinc-500'
                }`}
              >
                {saveState === 'pending' || saveState === 'saving'
                  ? '저장 중…'
                  : saveState === 'saved'
                    ? '저장됨 ✓'
                    : '날짜를 누르면 바로 저장돼요'}
              </span>
            )}
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

      {kickTarget && (
        <KickModal
          nickname={kickTarget.nickname}
          busy={busy}
          onClose={() => setKickTarget(null)}
          onConfirm={() => void confirmKick()}
        />
      )}
    </main>
  );
}

function KickModal({
  nickname,
  busy,
  onClose,
  onConfirm,
}: {
  nickname: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 dark:bg-zinc-900 sm:rounded-2xl">
        <h3 className="text-base font-semibold">{nickname} 내보내기</h3>
        <p className="mt-1 text-sm text-zinc-500">
          방에서 내보내면 {nickname}의 표도 같이 사라져요. 되돌릴 수 없어요.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="press h-11 flex-1 rounded-full border border-zinc-300 text-sm dark:border-zinc-700"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="press h-11 flex-1 rounded-full bg-rose-50 text-sm font-medium text-rose-700 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-rose-950/40 dark:text-rose-300 dark:disabled:bg-zinc-700"
          >
            {busy ? '내보내는 중…' : '내보내기'}
          </button>
        </div>
      </div>
    </div>
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
        <h3 className="text-base font-semibold">PIN으로 복원</h3>
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
  if (ms <= 0)
    return <span className="font-medium text-zinc-500">마감됨</span>;
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  // 24시간 이내면 위험 톤(rose)으로 강조
  const urgent = ms < 86400000;
  const cls = urgent
    ? 'font-semibold text-rose-600 dark:text-rose-400'
    : days <= 2
      ? 'font-medium text-amber-600 dark:text-amber-400'
      : '';
  if (days > 0) return <span className={cls}>D-{days}</span>;
  if (hours > 0) return <span className={cls}>{hours}시간 후 마감 ⏰</span>;
  return <span className={cls}>{minutes}분 후 마감 ⏰</span>;
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
