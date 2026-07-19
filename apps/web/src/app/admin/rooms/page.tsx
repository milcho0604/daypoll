'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import {
  AdminRoomList,
  adminListRooms,
  getAdminToken,
} from '@/lib/admin';
import EmptyState from '@/components/empty-state';

const LIMIT = 20;

// 짧은 날짜 — 모바일 카드/테이블에서 toLocaleString 풀표기(초까지)는 너무 넓다.
function fmtShort(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={
        status === 'active'
          ? 'inline-flex shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
          : 'inline-flex shrink-0 rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200'
      }
    >
      {status === 'active' ? '활성' : '종료'}
    </span>
  );
}

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
    // 클라이언트 전용 토큰 확인 후 목록 로드.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
        className="flex flex-col gap-2 sm:flex-row"
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="제목 또는 방 ID 검색"
          className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm dark:border-zinc-700 dark:bg-zinc-900 sm:flex-1"
        />
        <div className="flex gap-2">
          <select
            value={order}
            onChange={(e) => go({ order: e.target.value, offset: 0 })}
            className="h-11 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900 sm:flex-none"
          >
            <option value="recent">최근 생성순</option>
            <option value="participants">참여자 많은 순</option>
          </select>
          <button
            type="submit"
            className="press h-11 shrink-0 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
          >
            검색
          </button>
        </div>
      </form>

      {!data ? (
        <p className="text-sm text-zinc-500" aria-busy="true">불러오는 중…</p>
      ) : data.rooms.length === 0 ? (
        <EmptyState emoji="🔍" message="매칭되는 방이 없네요" />
      ) : (
        <>
          {/* 모바일: 카드 목록 (테이블은 6열이라 좁은 화면에서 깨짐) */}
          <ul className="flex flex-col gap-2 sm:hidden">
            {data.rooms.map((r) => (
              <li
                key={r.id}
                className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/admin/rooms/${r.id}`}
                    className="min-w-0 flex-1 truncate font-medium hover:underline"
                  >
                    {r.title}
                  </Link>
                  <StatusBadge status={r.status} />
                </div>
                <dl className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                  <span>참여자 {r.participantCount}명</span>
                  <span aria-hidden>·</span>
                  <span className="font-mono">{r.id}</span>
                  <span aria-hidden>·</span>
                  <span>생성 {fmtShort(r.createdAt)}</span>
                  {r.deadline && (
                    <>
                      <span aria-hidden>·</span>
                      <span>마감 {fmtShort(r.deadline)}</span>
                    </>
                  )}
                </dl>
              </li>
            ))}
          </ul>

          {/* 데스크탑: 테이블. 혹시 좁으면 컨테이너 안에서만 가로 스크롤 (페이지 본문은 안 밀림) */}
          <div className="hidden overflow-x-auto rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 sm:block">
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
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-zinc-500">
                      {r.id}
                    </td>
                    <td className="px-3 py-2">{r.participantCount}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-500">
                      {r.deadline ? fmtShort(r.deadline) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-500">
                      {fmtShort(r.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
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
