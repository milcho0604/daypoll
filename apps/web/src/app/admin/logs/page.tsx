'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import {
  AdminActionList,
  adminListActions,
  getAdminToken,
} from '@/lib/admin';
import EmptyState from '@/components/empty-state';

const PAGE = 50;

export default function AdminLogsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">불러오는 중…</p>}>
      <LogsInner />
    </Suspense>
  );
}

function LogsInner() {
  const router = useRouter();
  const [list, setList] = useState<AdminActionList | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!getAdminToken()) {
      router.replace('/admin/login');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await adminListActions({ limit: PAGE, offset: page * PAGE });
        if (!cancelled) setList(r);
      } catch {
        router.replace('/admin/login');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, router]);

  if (!list) {
    return <p className="text-sm text-zinc-500">불러오는 중…</p>;
  }

  const totalPages = Math.max(1, Math.ceil(list.total / PAGE));

  return (
    <div className="flex flex-col gap-4">
      <header>
        <Link
          href="/admin"
          className="text-xs text-zinc-500 hover:underline"
        >
          ← 대시보드
        </Link>
        <h1 className="mt-1 text-2xl font-bold">액션 로그</h1>
        <p className="text-xs text-zinc-500">
          어드민이 한 작업(삭제·강퇴·마감수정·cleanup) 의 시계열 기록. 총{' '}
          {list.total}건.
        </p>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {list.actions.length === 0 ? (
          <EmptyState emoji="📋" message="아직 기록이 없어요" />
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {list.actions.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 p-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">{labelFor(a.action)}</div>
                  <div className="mt-0.5 truncate text-xs text-zinc-500">
                    {a.roomId ? (
                      <Link
                        href={`/admin/rooms/${a.roomId}`}
                        className="font-mono hover:underline"
                      >
                        {a.roomId}
                      </Link>
                    ) : (
                      <span className="text-zinc-400">전체</span>
                    )}{' '}
                    {a.participantId != null && (
                      <span>· participant #{a.participantId}</span>
                    )}{' '}
                    {a.payload != null && (
                      <span className="text-zinc-400">· {JSON.stringify(a.payload)}</span>
                    )}
                  </div>
                </div>
                <time className="shrink-0 whitespace-nowrap text-xs text-zinc-500">
                  {new Date(a.createdAt).toLocaleString('ko-KR')}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="flex items-center justify-between text-xs text-zinc-500">
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="h-9 rounded-full border border-zinc-200 px-4 disabled:opacity-50 dark:border-zinc-700"
        >
          이전
        </button>
        <span>
          {page + 1} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          disabled={page >= totalPages - 1}
          className="h-9 rounded-full border border-zinc-200 px-4 disabled:opacity-50 dark:border-zinc-700"
        >
          다음
        </button>
      </footer>
    </div>
  );
}

function labelFor(action: string): string {
  switch (action) {
    case 'delete_room':
      return '🗑 방 삭제';
    case 'kick_participant':
      return '🚫 참여자 강퇴';
    case 'update_deadline':
      return '⏰ 마감일 수정';
    case 'cleanup':
      return '🧹 일괄 정리';
    case 'login':
      return '🔑 어드민 로그인';
    default:
      return action;
  }
}
