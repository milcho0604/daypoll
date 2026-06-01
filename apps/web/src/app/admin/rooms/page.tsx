'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import {
  AdminRoomList,
  adminListRooms,
  getAdminToken,
} from '@/lib/admin';

const LIMIT = 20;

function RoomsList() {
  const router = useRouter();
  const sp = useSearchParams();
  const offset = Number(sp.get('offset') ?? 0);
  const q = sp.get('q') ?? '';
  const order = (sp.get('order') ?? 'recent') as 'recent' | 'participants';

  const [data, setData] = useState<AdminRoomList | null>(null);
  const [search, setSearch] = useState(q);

  const load = useCallback(async () => {
    try {
      setData(await adminListRooms({ limit: LIMIT, offset, order, q }));
    } catch {
      router.replace('/admin/login');
    }
  }, [offset, order, q, router]);

  useEffect(() => {
    if (!getAdminToken()) {
      router.replace('/admin/login');
      return;
    }
    load();
  }, [load, router]);

  function go(patch: { offset?: number; q?: string; order?: string }) {
    const next = new URLSearchParams(sp.toString());
    Object.entries(patch).forEach(([k, v]) => {
      if (v == null || v === '') next.delete(k);
      else next.set(k, String(v));
    });
    router.push(`/admin/rooms?${next.toString()}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">방 목록</h1>
        <Link href="/admin" className="text-sm text-zinc-500 hover:underline">
          ← 대시보드
        </Link>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          go({ q: search, offset: 0 });
        }}
        className="flex gap-2"
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="제목 또는 방 ID 검색"
          className="h-11 flex-1 rounded-xl border border-zinc-200 bg-white px-4 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <select
          value={order}
          onChange={(e) => go({ order: e.target.value, offset: 0 })}
          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="recent">최근 생성순</option>
          <option value="participants">참여자 많은 순</option>
        </select>
        <button
          type="submit"
          className="h-11 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
        >
          검색
        </button>
      </form>

      {!data ? (
        <p className="text-sm text-zinc-500">불러오는 중…</p>
      ) : data.rooms.length === 0 ? (
        <p className="text-sm text-zinc-500">결과가 없습니다.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 text-left text-xs text-zinc-500 dark:bg-zinc-800">
              <tr>
                <th className="px-3 py-2 font-medium">제목</th>
                <th className="px-3 py-2 font-medium">방 ID</th>
                <th className="px-3 py-2 font-medium">참여자</th>
                <th className="px-3 py-2 font-medium">마감</th>
                <th className="px-3 py-2 font-medium">상태</th>
                <th className="px-3 py-2 font-medium">생성</th>
              </tr>
            </thead>
            <tbody>
              {data.rooms.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60"
                >
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/rooms/${r.id}`}
                      className="font-medium hover:underline"
                    >
                      {r.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-zinc-500">{r.id}</td>
                  <td className="px-3 py-2">{r.participantCount}</td>
                  <td className="px-3 py-2 text-xs text-zinc-500">
                    {r.deadline ? new Date(r.deadline).toLocaleString('ko-KR') : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        r.status === 'active'
                          ? 'inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
                          : 'inline-flex rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200'
                      }
                    >
                      {r.status === 'active' ? '활성' : '종료'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-500">
                    {new Date(r.createdAt).toLocaleString('ko-KR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && (
        <footer className="flex items-center justify-between text-sm text-zinc-500">
          <span>
            {data.total}건 중 {data.offset + 1}–
            {Math.min(data.offset + LIMIT, data.total)}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => go({ offset: Math.max(0, offset - LIMIT) })}
              className="h-9 rounded-full border border-zinc-300 px-4 disabled:opacity-50 dark:border-zinc-700"
            >
              이전
            </button>
            <button
              type="button"
              disabled={offset + LIMIT >= data.total}
              onClick={() => go({ offset: offset + LIMIT })}
              className="h-9 rounded-full border border-zinc-300 px-4 disabled:opacity-50 dark:border-zinc-700"
            >
              다음
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}

export default function AdminRoomsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">불러오는 중…</p>}>
      <RoomsList />
    </Suspense>
  );
}
