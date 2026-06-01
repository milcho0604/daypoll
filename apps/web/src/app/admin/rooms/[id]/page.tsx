'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  AdminRoomDetail,
  adminDeleteRoom,
  adminRoomDetail,
  getAdminToken,
} from '@/lib/admin';

export default function AdminRoomDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const roomId = params.id;
  const [data, setData] = useState<AdminRoomDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    load();
  }, [load, router]);

  async function onDelete() {
    if (!confirm(`정말 이 방을 삭제할까요?\n${data?.title}`)) return;
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

  if (!data) {
    return <p className="text-sm text-zinc-500">불러오는 중…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/rooms"
            className="text-xs text-zinc-500 hover:underline"
          >
            ← 방 목록
          </Link>
          <h1 className="mt-1 text-2xl font-bold">{data.title}</h1>
          <p className="text-xs text-zinc-500">
            <span className="font-mono">{data.id}</span> ·{' '}
            생성 {new Date(data.createdAt).toLocaleString('ko-KR')} ·{' '}
            마감 {data.deadline ? new Date(data.deadline).toLocaleString('ko-KR') : '무기한'}
            {!data.hasCreator && ' · 개설자 토큰 없음'}
          </p>
        </div>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="h-10 rounded-full bg-red-600 px-4 text-sm font-medium text-white disabled:bg-zinc-300"
        >
          {busy ? '삭제 중…' : '방 삭제'}
        </button>
      </header>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold">날짜별 득표</h2>
        {data.dates.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">날짜 없음</p>
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
        <h2 className="text-sm font-semibold">참여자 ({data.participants.length})</h2>
        {data.participants.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">없음</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
            {data.participants.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span className="font-medium">{p.nickname}</span>
                  <span className="ml-2 text-xs text-zinc-500">
                    {new Date(p.createdAt).toLocaleString('ko-KR')}
                  </span>
                </div>
                <span className="text-zinc-600">{p.voteCount}표</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
