'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AdminRoomDetail,
  adminDeleteRoom,
  adminDownloadCsv,
  adminKickParticipant,
  adminRoomDetail,
  adminUpdateRoomDeadline,
  getAdminToken,
} from '@/lib/admin';
import EmptyState from '@/components/empty-state';

export default function AdminRoomDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const roomId = params.id;
  const [data, setData] = useState<AdminRoomDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [showDeadlineModal, setShowDeadlineModal] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // Date.now() 를 render 단계가 아닌 effect 에서 sampling (react-hooks/purity 규칙)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
  }, [data?.deadline]);

  const load = useCallback(async () => {
    try {
      setData(await adminRoomDetail(roomId));
    } catch {
      router.replace('/admin/login');
    }
  }, [roomId, router]);

  useEffect(() => {
    if (!getAdminToken()) {
      router.replace('/admin/login');
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load, router]);

  const filteredParticipants = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    if (!term) return data.participants;
    return data.participants.filter((p) =>
      p.nickname.toLowerCase().includes(term),
    );
  }, [data, q]);

  async function onDelete() {
    if (!data) return;
    if (!confirm(`정말 이 방을 삭제할까요?\n${data.title}`)) return;
    setBusy(true);
    setError(null);
    try {
      await adminDeleteRoom(roomId);
      router.push('/admin/rooms');
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  async function onKick(participantId: number, nickname: string) {
    if (!confirm(`${nickname} 를 방에서 내보낼까요? 표도 같이 사라집니다.`))
      return;
    setBusy(true);
    setError(null);
    try {
      await adminKickParticipant(roomId, participantId);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onSaveDeadline(value: string | null) {
    setBusy(true);
    setError(null);
    try {
      await adminUpdateRoomDeadline(roomId, value);
      setShowDeadlineModal(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onExportCsv() {
    try {
      await adminDownloadCsv(
        `/admin/rooms/${roomId}/export.csv`,
        `whenever-${roomId}.csv`,
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!data) {
    return <p className="text-sm text-zinc-500">불러오는 중…</p>;
  }

  const deadlineLabel = data.deadline
    ? `${new Date(data.deadline).toLocaleString('ko-KR')}`
    : '무기한';
  const isClosed =
    !!data.deadline && now != null && new Date(data.deadline).getTime() <= now;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/admin/rooms"
            className="text-xs text-zinc-500 hover:underline"
          >
            ← 방 목록
          </Link>
          <h1 className="mt-1 text-2xl font-bold">{data.title}</h1>
          <p className="text-xs text-zinc-500">
            <span className="font-mono">{data.id}</span> · 생성{' '}
            {new Date(data.createdAt).toLocaleString('ko-KR')} ·{' '}
            <span
              className={
                isClosed
                  ? 'text-amber-600 dark:text-amber-300'
                  : 'text-emerald-600 dark:text-emerald-300'
              }
            >
              {isClosed ? '마감됨' : '활성'}
            </span>{' '}
            · 마감 {deadlineLabel}
            {!data.hasCreator && ' · 개설자 토큰 없음'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onExportCsv}
            className="h-9 rounded-full border border-zinc-200 bg-white px-4 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            CSV 내보내기
          </button>
          <button
            type="button"
            onClick={() => setShowDeadlineModal(true)}
            className="h-9 rounded-full border border-zinc-200 bg-white px-4 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            마감일 수정
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="h-9 rounded-full bg-red-600 px-4 text-xs font-medium text-white disabled:bg-zinc-300"
          >
            {busy ? '삭제 중…' : '방 삭제'}
          </button>
        </div>
      </header>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold">날짜별 득표</h2>
        {data.dates.length === 0 ? (
          <EmptyState emoji="📅" message="후보 날짜가 없어요" />
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {data.dates.map((d, idx) => (
              <li
                key={d.dateId}
                className="flex flex-col gap-1 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {idx + 1}. {d.date}
                  </span>
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    {d.votes}표
                  </span>
                </div>
                {d.voters.length > 0 && (
                  <p className="text-xs text-zinc-500">{d.voters.join(', ')}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">
            참여자 ({filteredParticipants.length}/{data.participants.length})
          </h2>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="닉네임으로 필터"
            className="h-9 w-48 rounded-lg border border-zinc-200 bg-white px-3 text-xs dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>
        {filteredParticipants.length === 0 ? (
          <EmptyState
            emoji={q ? '🔍' : '👥'}
            message={q ? '매칭되는 참여자가 없네요' : '아직 참여자가 없어요'}
          />
        ) : (
          <ul className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
            {filteredParticipants.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 py-2 text-sm"
              >
                <div className="min-w-0">
                  <span className="font-medium">{p.nickname}</span>
                  <span className="ml-2 text-xs text-zinc-500">
                    {new Date(p.createdAt).toLocaleString('ko-KR')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-600">{p.voteCount}표</span>
                  <button
                    type="button"
                    onClick={() => onKick(p.id, p.nickname)}
                    disabled={busy}
                    className="h-7 rounded-full border border-zinc-300 px-2 text-xs hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                  >
                    강퇴
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {showDeadlineModal && (
        <DeadlineModal
          current={data.deadline}
          onClose={() => setShowDeadlineModal(false)}
          onSave={onSaveDeadline}
        />
      )}
    </div>
  );
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
        <h3 className="text-base font-semibold">마감일 수정 (어드민)</h3>
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
            className="mt-3 h-12 w-full rounded-xl border border-zinc-200 bg-white px-3 text-base dark:border-zinc-800 dark:bg-zinc-950"
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
              if (Number.isNaN(t)) return;
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
