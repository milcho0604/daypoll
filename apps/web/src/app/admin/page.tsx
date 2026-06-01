'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  AdminStats,
  adminCleanup,
  adminGetStats,
  getAdminToken,
} from '@/lib/admin';

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState(90);

  useEffect(() => {
    if (!getAdminToken()) {
      router.replace('/admin/login');
      return;
    }
    (async () => {
      try {
        setStats(await adminGetStats());
      } catch {
        router.replace('/admin/login');
      }
    })();
  }, [router]);

  async function onCleanup() {
    if (!confirm(`${days}일 이상된 방을 정리합니다. 진행할까요?`)) return;
    setBusy(true);
    try {
      const r = await adminCleanup(days);
      alert(`삭제된 방: ${r.removed}개`);
      setStats(await adminGetStats());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!stats) {
    return <p className="text-sm text-zinc-500">불러오는 중…</p>;
  }

  const max = Math.max(1, ...stats.dailyCreated.map((d) => d.count));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">대시보드</h1>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="총 방" value={stats.totalRooms} />
        <Kpi label="총 참여자" value={stats.totalParticipants} />
        <Kpi label="총 투표" value={stats.totalVotes} />
        <Kpi label="방당 평균 참여자" value={stats.avgParticipantsPerRoom} />
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi label="활성 방" value={stats.activeRooms} />
        <Kpi label="종료 방" value={stats.closedRooms} />
        <Kpi label="마감일 설정 방" value={stats.roomsWithDeadline} />
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold">최근 30일 방 생성 추이</h2>
        {stats.dailyCreated.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">데이터가 없습니다.</p>
        ) : (
          <ul className="mt-4 flex h-32 items-end gap-1">
            {stats.dailyCreated.map((d) => (
              <li
                key={d.day}
                title={`${d.day} · ${d.count}개`}
                className="flex-1 rounded-t bg-zinc-900 dark:bg-zinc-100"
                style={{ height: `${(d.count / max) * 100}%`, minHeight: 2 }}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold">방 정리</h2>
        <p className="mt-1 text-xs text-zinc-500">
          입력한 일수보다 오래된 방을 일괄 삭제합니다 (CASCADE).
        </p>
        <div className="mt-3 flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="h-10 w-24 rounded-lg border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <span className="text-sm text-zinc-500">일 이상</span>
          <button
            type="button"
            onClick={onCleanup}
            disabled={busy}
            className="ml-auto h-10 rounded-full bg-red-600 px-4 text-sm font-medium text-white disabled:bg-zinc-300"
          >
            {busy ? '정리 중…' : '정리 실행'}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </section>

      <Link
        href="/admin/rooms"
        className="inline-flex h-11 w-fit items-center rounded-full border border-zinc-300 px-5 text-sm dark:border-zinc-700"
      >
        방 목록으로 →
      </Link>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
