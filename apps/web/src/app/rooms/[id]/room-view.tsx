'use client';

import type { DateResult, RegionCode, RoomDetail } from '@whenever/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiBaseUrl, ApiError } from '@/lib/api';
import {
  confirmDate,
  getMe,
  getResults,
  getRoom,
  joinRoom,
  kickParticipant,
  recoverParticipant,
  unconfirmDate,
  updateAvailabilities,
  setDecline,
  updateDeadline,
  updateRegion,
} from '@/lib/rooms';
import { getSocket, joinRoomChannel, leaveRoomChannel } from '@/lib/socket';
import { readTokens, writeTokens } from '@/lib/tokens';
import { recordRoom } from '@/lib/recent-rooms';
import { formatDateKR } from '@/lib/format';
import DateAvailabilityPicker from '@/components/date-availability-picker';
import CrownIcon from '@/components/icons/crown';
import EmptyState from '@/components/empty-state';
import ConfirmModal from '@/components/confirm-modal';
import RecoverModal from '@/components/room/recover-modal';
import DeadlineModal from '@/components/room/deadline-modal';
import RankList from '@/components/room/rank-list';
import PersonList from '@/components/room/person-list';
import VotersModal from '@/components/room/voters-modal';
import WeatherStrip from '@/components/room/weather-strip';

const POLL_INTERVAL_MS_DEFAULT = 4000;
const POLL_INTERVAL_MS_WHEN_LIVE = 30000; // 소켓 살아있으면 백업용 폴링은 느리게

type Me = {
  participantId: number;
  nickname: string;
  dateIds: number[];
  declined: boolean;
};

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
  // 사람 단위 불참 — 이번 모임 자체를 못 감. 가능 날짜 선택과 상호배타적.
  const [declined, setDeclined] = useState(false);
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
  const [recoverNeedsNickname, setRecoverNeedsNickname] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<
    'idle' | 'pending' | 'saving' | 'saved' | 'error'
  >('idle');
  const [showDeadlineModal, setShowDeadlineModal] = useState(false);
  // 지역(날씨) 저장 실패는 모달 안에 보여준다 — 메인 에러 박스는 모달(z-50)에 가려짐
  const [regionError, setRegionError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [live, setLive] = useState(false);
  const [showAllResults, setShowAllResults] = useState(false);
  const [showAllWinners, setShowAllWinners] = useState(false);
  const [view, setView] = useState<'date' | 'person'>('date');
  const [meLoading, setMeLoading] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [resultsCopied, setResultsCopied] = useState(false);
  // 확정 소식(날짜 확정 알림)을 단톡방에 붙이려고 복사했을 때 잠깐 뜨는 피드백.
  const [announceCopied, setAnnounceCopied] = useState(false);
  const [expandedDates, setExpandedDates] = useState<Set<number>>(new Set());
  const [expandedPersons, setExpandedPersons] = useState<Set<number>>(new Set());
  const [kickTarget, setKickTarget] = useState<{
    id: number;
    nickname: string;
  } | null>(null);
  // 확정된 1위 날짜 탭 → 누가 가능한지 팝업. dateId 만 저장해 실시간 갱신 반영.
  const [winnerVoterDateId, setWinnerVoterDateId] = useState<number | null>(null);
  // 모임 확정 — 방장이 '이 날로 확정' 누르면 확인 모달, 해제는 별도 확인.
  const [confirmTarget, setConfirmTarget] = useState<{
    dateId: number;
    date: string;
  } | null>(null);
  const [showUnconfirm, setShowUnconfirm] = useState(false);
  // 토글 직후 저장 확정 전까지 폴링이 낙관적 표시를 덮어쓰지 않게 막는 플래그
  const dirtyRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const RESULTS_PREVIEW = 5;
  const PERSON_PREVIEW = 8; // 사람별 뷰 — 2줄(grid-cols-4) 미리보기
  const WINNERS_PREVIEW = 6; // 1위 확정 칩 — 6개 까지, 나머지는 더보기

  const isConfirmed = room.confirmedDateId != null;
  // 확정됐거나 마감 지나면 투표 잠금.
  const isLocked =
    isConfirmed || (!!room.deadline && new Date(room.deadline).getTime() <= now);
  const isCreator = !!creatorToken;

  // '내 방' 목록에 기록 — 입장/재방문/이미 참여한 방까지 이 한 곳에서 커버.
  useEffect(() => {
    recordRoom(roomId, room.title);
  }, [roomId, room.title]);

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
          setDeclined(m.declined);
        } else {
          // 토큰이 서버에 없는 경우 (예: 방 초기화) → 닉네임 다시 받기
          setMe(null);
          setClientToken(undefined);
        }
      } catch (err) {
        console.warn('[room] me fetch failed', err);
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
        region: r.region,
        // declined 도 반영 — 빠뜨리면 남이 불참해도 "불참 N명" 배지가
        // 새로고침 전까지 안 뜬다 (소켓/폴링이 tick 만 태우므로).
        declined: r.declined,
        confirmedDateId: r.confirmedDateId,
        confirmedDate: r.confirmedDate,
        confirmedAt: r.confirmedAt,
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
    const onRegion = (payload: { region: RegionCode | null }) => {
      // 방장이 지역을 켜고/끄면 열려있는 참여자 화면에도 날씨 카드 즉시 반영
      setRoom((prev) => ({ ...prev, region: payload.region }));
    };
    const onDeleted = () => {
      // 방이 어드민에 의해 삭제됨 — 홈으로 보낼지, 토스트로 알릴지. 일단 페이지 새로고침.
      window.location.reload();
    };
    const onConfirmed = (payload: {
      confirmedDateId: number | null;
      confirmedDate: string | null;
    }) => {
      // 방장이 확정/해제하면 열려있는 참여자 화면에 즉시 배너 반영.
      setRoom((prev) => ({
        ...prev,
        confirmedDateId: payload.confirmedDateId,
        confirmedDate: payload.confirmedDate,
        confirmedAt:
          payload.confirmedDateId != null ? new Date().toISOString() : null,
      }));
      setNow(Date.now());
    };

    if (socket.connected) onConnect();
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:results_updated', onResults);
    socket.on('room:deadline_updated', onDeadline);
    socket.on('room:region_updated', onRegion);
    socket.on('room:deleted', onDeleted);
    socket.on('room:confirmed', onConfirmed);

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
      socket.off('room:region_updated', onRegion);
      socket.off('room:deleted', onDeleted);
      socket.off('room:confirmed', onConfirmed);
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

  // 사람별 뷰 — 참여자 → 그 사람이 가능 표시한 날짜들 (날짜별의 역집계).
  const byPerson = useMemo(() => {
    const map = new Map<
      number,
      { id: number; nickname: string; dates: { dateId: number; date: string }[] }
    >();
    for (const r of room.results) {
      for (const v of r.voters ?? []) {
        let p = map.get(v.id);
        if (!p) {
          p = { id: v.id, nickname: v.nickname, dates: [] };
          map.set(v.id, p);
        }
        p.dates.push({ dateId: r.dateId, date: r.date });
      }
    }
    const arr = [...map.values()];
    for (const p of arr) p.dates.sort((a, b) => a.date.localeCompare(b.date));
    arr.sort(
      (a, b) =>
        b.dates.length - a.dates.length || a.nickname.localeCompare(b.nickname),
    );
    return arr;
  }, [room.results]);

  const maxVotes = sortedResults.reduce((m, r) => Math.max(m, r.votes), 0);

  // 1위(들) — 동표면 공동 1위. 순위 트로피/하이라이트 + 마감 확정 카드 공용.
  const winnerIds = new Set<number>(
    maxVotes > 0
      ? sortedResults.filter((r) => r.votes === maxVotes).map((r) => r.dateId)
      : [],
  );
  // 마감(deadline)으로 잠긴 경우의 1위(들). 명시적 확정은 아래 confirmedResult 로 별도 처리.
  const winners =
    isLocked && !isConfirmed && maxVotes > 0
      ? sortedResults.filter((r) => r.votes === maxVotes)
      : [];
  // 방장이 명시적으로 확정한 날짜 (있으면 전용 확정 카드로 강조).
  const confirmedResult = isConfirmed
    ? (sortedResults.find((r) => r.dateId === room.confirmedDateId) ?? null)
    : null;
  // 현재 1위 (방장 확정 CTA 의 기본 대상).
  const leader = sortedResults.length > 0 ? sortedResults[0] : null;

  // 사람별 뷰 하단 — 아직 응답 안 한 참여자 수 (독촉용).
  // 불참자는 "응답함"이니 미응답에서 뺀다.
  const declinedList = room.declined ?? [];
  const nonVoterCount = Math.max(
    0,
    room.participantCount - byPerson.length - declinedList.length,
  );

  // 순위 전체 펼치기/접기 — 행마다 탭하지 않고 누가 어느 날짜에 됐는지 한 번에.
  const expandableIds = sortedResults
    .filter((r) => r.votes > 0)
    .map((r) => r.dateId);
  const allExpanded =
    expandableIds.length > 0 &&
    expandableIds.every((id) => expandedDates.has(id));
  const toggleAllExpanded = () =>
    setExpandedDates(allExpanded ? new Set() : new Set(expandableIds));

  const togglePerson = (id: number) =>
    setExpandedPersons((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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
        declined: res.declined,
      }));
    } catch (err) {
      setSaveState('error');
      setError(extractMsg(err));
    }
  }

  // 사람 단위 불참 토글. 불참하면 고른 날짜는 서버가 비우므로 로컬도 비운다.
  async function toggleDecline(next: boolean) {
    if (isLocked || !clientToken) return;
    setDeclined(next);
    if (next) setSelected(new Set()); // 불참이면 가능 날짜 해제
    // 낙관적: 내 이름을 불참 목록에 넣거나/빼고, 내 표를 결과에서 즉시 제거
    if (me) {
      const mine = { id: me.participantId, nickname: me.nickname };
      setRoom((prev) => ({
        ...prev,
        declined: next
          ? [...(prev.declined ?? []).filter((v) => v.id !== mine.id), mine]
          : (prev.declined ?? []).filter((v) => v.id !== mine.id),
        results: next
          ? prev.results.map((r) => {
              const voters = (r.voters ?? []).filter((v) => v.id !== mine.id);
              return { ...r, voters, votes: voters.length };
            })
          : prev.results,
      }));
    }
    try {
      await setDecline(roomId, clientToken, next);
      const res = await getResults(roomId);
      setRoom((prev) => ({
        ...prev,
        results: res.results,
        participantCount: res.participantCount,
        deadline: res.deadline,
        declined: res.declined,
      }));
    } catch (err) {
      setError(extractMsg(err));
      setDeclined(!next); // 롤백
    }
  }

  async function onJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!nickname.trim()) return;
    if (usePin && !/^\d{4}$/.test(pin)) {
      setError('비밀번호는 숫자 4자리로 정해주세요.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // 방 만든 사람이 첫 입장 시 — localStorage 의 creator_token 같이 보내면
      // 백엔드가 이 participant 를 방 주인으로 link → 다른 기기 PIN 복원 시 회수.
      const localCreatorToken = creatorToken;
      const r = await joinRoom(roomId, {
        nickname: nickname.trim(),
        pin: usePin ? pin : undefined,
        creatorToken: localCreatorToken,
      });
      writeTokens(roomId, {
        clientToken: r.clientToken,
        // 백엔드가 link 했으면 응답에 같이 돌려준 creator_token 저장.
        // 첫 입장 시엔 이미 localStorage 에 있는 거랑 같음 (변화 없음).
        ...(r.creatorToken ? { creatorToken: r.creatorToken } : {}),
      });
      // 다음 방 진입 때 자동 채워주기
      window.localStorage.setItem('whenever_last_nickname', nickname.trim());
      setClientToken(r.clientToken);
      setMe({
        participantId: r.participantId,
        nickname: nickname.trim(),
        dateIds: [],
        declined: false,
      });
      setSelected(new Set());
      setDeclined(false);
      void tick(); // 참여자 수 즉시 반영
    } catch (err) {
      setError(extractMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function onRecover(pin: string, nickname?: string) {
    setBusy(true);
    setError(null);
    try {
      const r = await recoverParticipant(roomId, { pin, nickname });
      writeTokens(roomId, {
        clientToken: r.clientToken,
        // 방 주인이 다른 기기에서 PIN 으로 복원 시 — creator_token 도 같이 와서
        // 그 기기에서도 방 종료 / 마감 수정 / 강퇴 가능.
        ...(r.creatorToken ? { creatorToken: r.creatorToken } : {}),
      });
      if (r.creatorToken) setCreatorToken(r.creatorToken);
      setClientToken(r.clientToken);
      setShowRecover(false);
      setRecoverNeedsNickname(false);
      const m = await getMe(roomId, r.clientToken);
      setMe(m);
      setSelected(new Set(m?.dateIds ?? []));
      setDeclined(m?.declined ?? false);
    } catch (err) {
      // 같은 PIN 충돌이면 닉네임 입력 모드로 전환 (모달 유지)
      if (err instanceof ApiError && err.status === 409) {
        setRecoverNeedsNickname(true);
        setError('같은 비밀번호를 쓴 친구가 여러 명이에요. 닉네임도 알려주세요.');
      } else {
        setError(extractMsg(err));
      }
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

  // 확정 소식 알리기 — 방에 안 들어온 친구도 단톡방에서 바로 알게, "○/○로 확정!"
  // 문구를 만들어 공유(모바일 공유시트)하거나 클립보드에 복사한다.
  async function announceConfirmed() {
    if (!confirmedResult) return;
    const url = window.location.href;
    const text =
      `📅 ${room.title} 날짜 확정!\n` +
      `👉 ${formatDateKR(confirmedResult.date)}\n` +
      `아직 못 본 친구들 확인해요`;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: room.title, text, url });
        return;
      } catch {
        /* 공유 시트 취소 — 클립보드 fallback */
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setAnnounceCopied(true);
      setTimeout(() => setAnnounceCopied(false), 2000);
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

  // 모임 확정 — 방장이 후보 중 하나를 최종 날짜로. 확정 즉시 투표 잠금.
  async function onConfirm() {
    if (!creatorToken || !confirmTarget) return;
    setBusy(true);
    setError(null);
    try {
      await confirmDate(roomId, creatorToken, confirmTarget.dateId);
      setConfirmTarget(null);
      const fresh = await getRoom(roomId);
      setRoom(fresh);
      setNow(Date.now());
    } catch (err) {
      setError(extractMsg(err));
    } finally {
      setBusy(false);
    }
  }

  // 확정 해제 — 투표를 다시 연다.
  async function onUnconfirm() {
    if (!creatorToken) return;
    setBusy(true);
    setError(null);
    try {
      await unconfirmDate(roomId, creatorToken);
      setShowUnconfirm(false);
      const fresh = await getRoom(roomId);
      setRoom(fresh);
      setNow(Date.now());
    } catch (err) {
      setError(extractMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function onSaveRegion(value: RegionCode | null) {
    if (!creatorToken) return;
    setBusy(true);
    setRegionError(null);
    try {
      const r = await updateRegion(roomId, creatorToken, value);
      setRoom((prev) => ({ ...prev, region: r.region }));
    } catch {
      // 셀렉트는 room.region(서버값) 기준 controlled 라 실패 시 자동으로 되돌아간다
      setRegionError('지역 저장이 안 됐어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  }

  // 방 종료 = 지금 즉시 마감(deadline=now). 기존 잠금 로직 재사용 → 투표 차단 + 확정 카드.
  // 모달 통합 후엔 closeRoomFromModal 이 모달도 같이 닫음.
  async function closeRoomFromModal() {
    if (!creatorToken) return;
    setBusy(true);
    setError(null);
    try {
      const r = await updateDeadline(roomId, creatorToken, {
        deadline: new Date().toISOString(),
      });
      setRoom((prev) => ({ ...prev, deadline: r.deadline }));
      setNow(Date.now());
      setShowDeadlineModal(false);
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
          <div className="flex shrink-0 items-center gap-1.5">
            {isCreator && (
              <button
                type="button"
                onClick={() => setShowDeadlineModal(true)}
                className="press inline-flex h-9 items-center gap-1 rounded-full bg-zinc-100 px-3.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                aria-label="방 관리 — 마감일 수정 / 종료"
              >
                ⚙️ 방 관리
              </button>
            )}
            <button
              type="button"
              onClick={() => void shareRoom()}
              className="press inline-flex h-9 items-center gap-1 rounded-full bg-zinc-100 px-3.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {linkCopied ? '복사됨 ✓' : '🔗 링크 복사'}
            </button>
          </div>
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
          {room.createdBy && (
            <>
              <span aria-hidden>·</span>
              <span>by {room.createdBy}</span>
            </>
          )}
          <span aria-hidden>·</span>
          <span>참여자 {room.participantCount}명</span>
          <span aria-hidden>·</span>
          <DeadlineLabel deadline={room.deadline} now={now} />
        </div>
      </header>

      {confirmedResult && (
        <section className="fade-up mt-4 rounded-2xl border border-amber-300 bg-white p-5 ring-1 ring-amber-200/60 dark:border-amber-700 dark:bg-zinc-900 dark:ring-amber-900/60">
          <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-amber-500 px-3.5 text-xs font-semibold text-white shadow-sm dark:bg-amber-600">
            <CrownIcon className="h-3.5 w-3.5" />
            모임 확정!
          </span>
          <button
            type="button"
            onClick={() => setWinnerVoterDateId(confirmedResult.dateId)}
            aria-label={`${formatDateKR(confirmedResult.date)} 가능한 친구 보기`}
            className="press mt-3 flex h-20 w-full items-center justify-center rounded-2xl bg-amber-500 px-4 text-2xl font-bold text-white shadow-sm hover:bg-amber-600 hover:shadow-md sm:h-24 sm:text-3xl dark:bg-amber-600 dark:hover:bg-amber-500"
          >
            {formatDateKR(confirmedResult.date)}
          </button>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            이 날로 모여요! 몇 시에 볼지는 단톡방에서 정해요 🙂
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {/* 주 액션 — 방에 안 들어온 친구도 알게 단톡방에 확정 소식 뿌리기 */}
            <button
              type="button"
              onClick={() => void announceConfirmed()}
              className="press inline-flex h-10 items-center gap-1.5 rounded-full bg-zinc-900 px-4 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
            >
              {announceCopied ? '복사됨 ✓' : '📢 단톡방에 확정 알리기'}
            </button>
            <a
              href={`${apiBaseUrl}/rooms/${roomId}/winner.ics`}
              className="press inline-flex h-10 items-center gap-1.5 rounded-full bg-zinc-100 px-4 text-sm font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              📅 캘린더에 담기
            </a>
            <button
              type="button"
              onClick={() => void copyResults()}
              className="press inline-flex h-10 items-center gap-1.5 rounded-full bg-zinc-100 px-4 text-sm font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {resultsCopied ? '복사됨 ✓' : '결과 복사'}
            </button>
          </div>
          {isCreator && (
            <button
              type="button"
              onClick={() => setShowUnconfirm(true)}
              className="press mt-3 text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              확정 해제 (다시 투표 열기)
            </button>
          )}
        </section>
      )}

      {winners.length > 0 && (
        <section className="fade-up mt-4 rounded-2xl border border-amber-300 bg-white p-5 ring-1 ring-amber-200/60 dark:border-amber-700 dark:bg-zinc-900 dark:ring-amber-900/60">
          <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-amber-500 px-3.5 text-xs font-semibold text-white shadow-sm dark:bg-amber-600">
            <CrownIcon className="h-3.5 w-3.5" />
            투표 마감 — {winners.length > 1 ? '공동 1위!' : '날짜 확정!'}
          </span>
          {/* 확정 칩 grid — 단일은 full width + 큰 임팩트, 다중은 균형. 6개 까지, 나머지는 더보기.
              그라데이션 → 단색 amber-500. 축하는 여기(진짜 확정된 뒤) 한 곳에만 남긴다. */}
          {(() => {
            const visibleWinners = showAllWinners
              ? winners
              : winners.slice(0, WINNERS_PREVIEW);
            const hidden = winners.length - WINNERS_PREVIEW;
            return (
              <>
                <div
                  className={`mt-3 grid gap-2 ${
                    winners.length === 1
                      ? 'grid-cols-1'
                      : winners.length === 2
                        ? 'grid-cols-2'
                        : 'grid-cols-2 sm:grid-cols-3'
                  }`}
                >
                  {visibleWinners.map((w) => (
                    <button
                      key={w.dateId}
                      type="button"
                      onClick={() => setWinnerVoterDateId(w.dateId)}
                      aria-label={`${formatDateKR(w.date)} 가능한 친구 보기`}
                      className={`press flex items-center justify-center rounded-2xl bg-amber-500 px-4 font-bold text-white shadow-sm transition-shadow hover:bg-amber-600 hover:shadow-md dark:bg-amber-600 dark:hover:bg-amber-500 ${
                        winners.length === 1
                          ? 'h-20 text-2xl sm:h-24 sm:text-3xl'
                          : 'h-16 text-xl sm:text-2xl'
                      }`}
                    >
                      {formatDateKR(w.date)}
                    </button>
                  ))}
                </div>
                {hidden > 0 && (
                  <div className="mt-3 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setShowAllWinners((v) => !v)}
                      aria-expanded={showAllWinners}
                      className="press inline-flex h-9 items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-4 text-xs font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/60"
                    >
                      <span>
                        {showAllWinners ? '접기' : `더 보기 (+${hidden})`}
                      </span>
                      <span
                        aria-hidden
                        className={`text-[10px] transition-transform ${
                          showAllWinners ? 'rotate-180' : ''
                        }`}
                      >
                        ▾
                      </span>
                    </button>
                  </div>
                )}
              </>
            );
          })()}
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {winners[0].votes}표
            {winners.length > 1 ? ` · ${winners.length}일 동률` : ''} · 참여자{' '}
            {room.participantCount}명
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={`${apiBaseUrl}/rooms/${roomId}/winner.ics`}
              className="press inline-flex h-10 items-center gap-1.5 rounded-full bg-zinc-900 px-4 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
            >
              📅 캘린더에 담기
            </a>
            <button
              type="button"
              onClick={() => void copyResults()}
              className="press inline-flex h-10 items-center gap-1.5 rounded-full bg-zinc-100 px-4 text-sm font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {resultsCopied ? '복사됨 ✓' : '결과 복사'}
            </button>
            <a
              href={`/rooms/${roomId}/opengraph-image`}
              download={`${room.title}-결과.png`}
              className="press inline-flex h-10 items-center gap-1.5 rounded-full bg-zinc-100 px-4 text-sm font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              📥 이미지 저장
            </a>
          </div>
        </section>
      )}

      <WeatherStrip roomId={roomId} region={room.region} />

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
          {isCreator ? (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              <span aria-hidden>👑</span>
              방 만든 분이죠? 비밀번호 4자리를 정해두면 다른 폰에서도 이 방을 관리할 수 있어요
            </p>
          ) : (
            <p className="mt-2 text-xs text-zinc-500">
              ✨ 지금 이 폰에선 다음에 다시 와도 투표한 게 그대로 있어요.
            </p>
          )}
          {room.participantCount > 0 && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              <span aria-hidden>✨</span>
              이미 {room.participantCount}명이 답했어요
            </p>
          )}
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
              비밀번호 4자리 정하기 (다른 폰에서도 이어서 투표하려면)
            </label>
            <p className="-mt-1 ml-7 text-[11px] leading-5 text-zinc-400">
              이 폰에선 자동 저장 ✓ &nbsp;·&nbsp; 다른 폰에선 비밀번호로 불러오기
            </p>
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
                전에 다른 폰에서 투표했어요
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
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white dark:bg-white dark:text-zinc-900">
                <span aria-hidden>·</span>
                {me.nickname}
              </span>
            )}
          </div>
          {isLocked && (
            <p className="mt-2 rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {isConfirmed
                ? '이 모임은 날짜가 확정됐어요. 결과만 확인할 수 있어요.'
                : '투표가 마감되었습니다. 결과만 확인할 수 있어요.'}
            </p>
          )}
          {declined ? (
            // 불참 상태 — 캘린더 대신 안내 + 다시 참여 버튼
            <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-center dark:border-rose-900 dark:bg-rose-950/40">
              <p className="text-sm font-medium text-rose-700 dark:text-rose-300">
                🙅 이번 모임엔 참석이 어렵다고 표시했어요.
              </p>
              <button
                type="button"
                onClick={() => void toggleDecline(false)}
                disabled={isLocked}
                className="press mt-3 inline-flex h-10 items-center rounded-full bg-white px-4 text-sm font-medium text-zinc-700 shadow-sm disabled:opacity-50 dark:bg-zinc-900 dark:text-zinc-200"
              >
                다시 참여할래요
              </button>
            </div>
          ) : (
            <>
              <DateAvailabilityPicker
                candidates={room.dates}
                selectedIds={selected}
                onToggle={toggle}
                onBulkSet={(ids) => {
                  if (isLocked || !clientToken) return;
                  const next = new Set(ids);
                  setSelected(next);
                  scheduleSave(next);
                }}
                disabled={isLocked}
              />
              {!isLocked && (
                <div className="mt-3 flex justify-center">
                  <button
                    type="button"
                    onClick={() => void toggleDecline(true)}
                    className="press text-xs font-medium text-zinc-500 underline underline-offset-2 hover:text-rose-600 dark:hover:text-rose-400"
                  >
                    이번엔 참석이 어려워요 (불참)
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {isCreator && !isConfirmed && !isLocked && leader && leader.votes > 0 && (
        <section className="fade-up mt-6 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                이 날로 모임 정할까요?
              </p>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                현재 1위{' '}
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {formatDateKR(leader.date)}
                </span>{' '}
                · {leader.votes}표
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setConfirmTarget({ dateId: leader.dateId, date: leader.date })
              }
              className="press inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-amber-500 px-4 text-sm font-semibold text-white hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500"
            >
              <CrownIcon className="h-4 w-4" />이 날로 확정하기
            </button>
          </div>
          <p className="mt-2 text-[11px] text-zinc-400">
            다른 날로 정하려면 아래 순위에서 날짜를 펼쳐 &lsquo;이 날로 확정&rsquo; 을
            눌러요.
          </p>
        </section>
      )}

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h2 className="text-base font-semibold">
            {view === 'date' ? '실시간 순위' : '참여자별 가능 날짜'}
          </h2>
          {sortedResults.length > 0 && sortedResults[0].votes > 0 && (
            <div className="flex items-center gap-3">
              {view === 'date' && (
                <button
                  type="button"
                  onClick={toggleAllExpanded}
                  className="press text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-700 dark:hover:text-zinc-300"
                >
                  {allExpanded ? '전체 접기' : '전체 펼치기'}
                </button>
              )}
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
        {sortedResults.length > 0 && (
          <div className="mt-3 inline-flex rounded-full border border-zinc-200 bg-white p-0.5 dark:border-zinc-800 dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => setView('date')}
              className={`press h-8 rounded-full px-3.5 text-xs font-medium transition-colors ${
                view === 'date'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                  : 'text-zinc-500 dark:text-zinc-400'
              }`}
            >
              날짜별
            </button>
            <button
              type="button"
              onClick={() => setView('person')}
              className={`press h-8 rounded-full px-3.5 text-xs font-medium transition-colors ${
                view === 'person'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                  : 'text-zinc-500 dark:text-zinc-400'
              }`}
            >
              사람별
            </button>
          </div>
        )}
        {sortedResults.length === 0 ? (
          <EmptyState emoji="🌱" message="아직 첫 표를 기다리는 중이에요" />
        ) : view === 'person' ? (
          <PersonList
            people={byPerson}
            mePid={me?.participantId}
            expanded={expandedPersons}
            onToggle={togglePerson}
            preview={PERSON_PREVIEW}
            nonVoterCount={nonVoterCount}
          />
        ) : (
          <RankList
            results={sortedResults}
            maxVotes={maxVotes}
            winnerIds={winnerIds}
            expandedDates={expandedDates}
            onToggleExpanded={toggleExpanded}
            selected={selected}
            hasToken={!!clientToken}
            // 잠금/확정되면 강퇴 숨김 — 강퇴는 표수를 바꿔 확정 결과를 흔든다.
            isCreator={isCreator && !isLocked}
            onKick={(id, nickname) => setKickTarget({ id, nickname })}
            showAll={showAllResults}
            onToggleShowAll={() => setShowAllResults((v) => !v)}
            preview={RESULTS_PREVIEW}
            onConfirm={
              isCreator && !isLocked
                ? (dateId, date) => setConfirmTarget({ dateId, date })
                : undefined
            }
          />
        )}
        {/* 미투표자 넛지 — 조용한 숫자를 행동(재공유)으로. 마감/확정 전에만. */}
        {nonVoterCount > 0 && !isLocked && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs text-zinc-600 dark:text-zinc-300">
              아직{' '}
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {nonVoterCount}명
              </span>
              이 안 골랐어요
            </p>
            <button
              type="button"
              onClick={() => void shareRoom()}
              className="press inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-zinc-900 px-3.5 text-xs font-medium text-white dark:bg-white dark:text-zinc-900"
            >
              {linkCopied ? '복사됨 ✓' : '🔗 안 고른 친구 재촉하기'}
            </button>
          </div>
        )}
        {declinedList.length > 0 && (
          <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span className="font-medium text-rose-600 dark:text-rose-400">
                🙅 이번 모임 불참 {declinedList.length}명
              </span>
              <span className="text-zinc-500 dark:text-zinc-400">
                {declinedList.map((v) => v.nickname).join(' · ')}
              </span>
            </p>
          </div>
        )}
      </section>

      {error && (
        <p
          role="alert"
          aria-live="assertive"
          className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
        >
          {error}
        </p>
      )}

      {clientToken && !isLocked && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
          <div
            className="mx-auto flex h-10 w-full max-w-2xl items-center justify-between gap-3"
            aria-live="polite"
          >
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
          currentRegion={room.region ?? null}
          regionError={regionError}
          isLocked={isLocked}
          busy={busy}
          onClose={() => {
            setShowDeadlineModal(false);
            setRegionError(null);
          }}
          onSave={onSaveDeadline}
          onSaveRegion={(v) => void onSaveRegion(v)}
          onCloseNow={() => void closeRoomFromModal()}
        />
      )}

      <ConfirmModal
        open={confirmTarget !== null}
        title="이 날로 확정할까요?"
        message={
          confirmTarget
            ? `${formatDateKR(confirmTarget.date)} 로 모임을 확정해요.\n확정하면 투표가 잠겨요 (나중에 해제할 수 있어요).`
            : ''
        }
        confirmLabel="확정하기"
        busy={busy}
        onConfirm={() => void onConfirm()}
        onCancel={() => setConfirmTarget(null)}
      />

      <ConfirmModal
        open={showUnconfirm}
        title="확정을 해제할까요?"
        message={'투표를 다시 열어요.\n확정된 날짜 표시는 사라져요.'}
        confirmLabel="확정 해제"
        busy={busy}
        onConfirm={() => void onUnconfirm()}
        onCancel={() => setShowUnconfirm(false)}
      />

      {showRecover && (
        <RecoverModal
          onClose={() => {
            setShowRecover(false);
            setRecoverNeedsNickname(false);
          }}
          onSubmit={onRecover}
          busy={busy}
          needsNickname={recoverNeedsNickname}
        />
      )}

      {(() => {
        const opened =
          winnerVoterDateId != null
            ? winners.find((w) => w.dateId === winnerVoterDateId) ?? null
            : null;
        return (
          <VotersModal
            open={!!opened}
            date={opened?.date ?? null}
            voters={opened?.voters ?? []}
            onClose={() => setWinnerVoterDateId(null)}
          />
        );
      })()}

      <ConfirmModal
        open={!!kickTarget}
        title={kickTarget ? `${kickTarget.nickname} 내보내기` : ''}
        message={
          kickTarget
            ? `방에서 내보내면 ${kickTarget.nickname}의 표도 같이 사라져요. 되돌릴 수 없어요.`
            : undefined
        }
        confirmLabel="내보내기"
        danger
        busy={busy}
        onConfirm={() => void confirmKick()}
        onCancel={() => setKickTarget(null)}
      />

    </main>
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
  // 마감 임박 단계: D-3 이내는 옅은 위험 톤(rose-500), D-1 이내는 진한 위험 톤(rose-600)
  const urgent = ms < 86400000;
  const cls = urgent
    ? 'font-semibold text-rose-600 dark:text-rose-400'
    : days <= 2
      ? 'font-medium text-rose-500 dark:text-rose-400'
      : '';
  if (days > 0) return <span className={cls}>D-{days}</span>;
  if (hours > 0) return <span className={cls}>{hours}시간 후 마감 ⏰</span>;
  return <span className={cls}>{minutes}분 후 마감 ⏰</span>;
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
