'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { adminActivity, getAdminToken } from '@/lib/admin';
import { ApiError } from '@/lib/api';
import { getSocket, joinAdminChannel } from '@/lib/socket';
import {
  FeedRow,
  activityEmoji,
  formatAbsolute,
  formatRelative,
  historyToRow,
  socketToRow,
} from '@/lib/activity';
import EmptyState from '@/components/empty-state';

const PAGE = 30;

export default function AdminActivityPage() {
  const router = useRouter();
  // 실시간(소켓)으로 들어온 최신 이벤트. 히스토리보다 위에 쌓인다.
  const [liveRows, setLiveRows] = useState<FeedRow[]>([]);
  // 서버 히스토리 (더 보기로 누적).
  const [history, setHistory] = useState<FeedRow[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedOnce = useRef(false);

  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      router.replace('/admin/login');
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const feed = await adminActivity({ limit: PAGE });
        if (cancelled) return;
        setHistory(feed.events.map(historyToRow));
        setNextBefore(feed.nextBefore);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          router.replace('/admin/login');
          return;
        }
        if (!cancelled) setError('활동을 불러오지 못했어요.');
      } finally {
        if (!cancelled) {
          setLoading(false);
          loadedOnce.current = true;
        }
      }
    })();

    const socket = getSocket();
    const onConnect = () => setLive(true);
    const onDisconnect = () => setLive(false);
    const onEvent = (e: { type: string; ts: string; [k: string]: unknown }) => {
      setLiveRows((prev) => [socketToRow(e), ...prev].slice(0, 200));
    };
    if (socket.connected) onConnect();
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('admin:event', onEvent);
    const stopAuth = joinAdminChannel(token);

    return () => {
      cancelled = true;
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('admin:event', onEvent);
      stopAuth();
    };
  }, [router]);

  async function loadMore() {
    if (!nextBefore) return;
    setLoadingMore(true);
    try {
      const feed = await adminActivity({ limit: PAGE, before: nextBefore });
      setHistory((prev) => [...prev, ...feed.events.map(historyToRow)]);
      setNextBefore(feed.nextBefore);
    } catch {
      setError('더 불러오지 못했어요.');
    } finally {
      setLoadingMore(false);
    }
  }

  // 실시간 + 히스토리를 합쳐 최신순으로. 중복 방지: 같은 (type,ts,roomId)면 하나로.
  const seen = new Set<string>();
  const rows = [...liveRows, ...history].filter((r) => {
    const k = `${r.type}|${r.ts.slice(0, 19)}|${r.roomId ?? ''}|${r.text}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">활동</h1>
          <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
            <span
              aria-hidden
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                live ? 'bg-emerald-500' : 'bg-zinc-400'
              }`}
            />
            {live ? 'LIVE' : '연결 중…'}
          </span>
        </div>
        <Link
          href="/admin"
          className="h-9 rounded-full border border-zinc-200 bg-white px-4 text-xs font-medium leading-9 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          ← 대시보드
        </Link>
      </header>

      <p className="text-xs text-zinc-500">
        방 생성 · 입장 · 투표 · 불참을 시간순으로 모았어요. 새 활동은 위에 실시간으로
        쌓여요.
      </p>

      <section className="rounded-2xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
        {loading ? (
          <p className="p-6 text-center text-sm text-zinc-500">불러오는 중…</p>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState emoji="📭" message="아직 활동이 없어요" />
          </div>
        ) : (
          <ul className="flex flex-col">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 border-b border-zinc-100 px-3 py-2.5 last:border-0 dark:border-zinc-800/60"
              >
                <span aria-hidden className="shrink-0 text-base">
                  {activityEmoji(r.type)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {r.roomId ? (
                    <Link
                      href={`/admin/rooms/${r.roomId}`}
                      className="hover:underline"
                    >
                      {r.text}
                    </Link>
                  ) : (
                    r.text
                  )}
                </span>
                <time
                  dateTime={r.ts}
                  title={formatAbsolute(r.ts)}
                  className="shrink-0 tabular-nums text-xs text-zinc-400"
                >
                  {formatRelative(r.ts)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      {nextBefore && (
        <button
          type="button"
          onClick={() => void loadMore()}
          disabled={loadingMore}
          className="press mx-auto h-10 rounded-full border border-zinc-300 px-6 text-sm disabled:opacity-50 dark:border-zinc-700"
        >
          {loadingMore ? '불러오는 중…' : '더 보기'}
        </button>
      )}
    </div>
  );
}
