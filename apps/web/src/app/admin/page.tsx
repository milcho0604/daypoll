'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AdminStats,
  adminCleanup,
  adminDownloadCsv,
  adminGetStats,
  getAdminToken,
} from '@/lib/admin';
import { ApiError } from '@/lib/api';
import { getSocket, joinAdminChannel } from '@/lib/socket';
import EmptyState from '@/components/empty-state';
import ConfirmModal from '@/components/confirm-modal';

const POLL_MS = 30_000;
const FEED_MAX = 20;

interface FeedItem {
  id: string;
  ts: string;
  type: string;
  label: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // 입력은 문자열로 보관 — type=number 의 빈 값 강제 0·선행 0(010) 문제를 피한다.
  const [days, setDays] = useState('90');
  const [cleanupConfirm, setCleanupConfirm] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<number | null>(null);
  // 실제로 쓸 때만 정수로. 빈 값/0 이면 0.
  const daysNum = parseInt(days, 10) || 0;

  const refresh = useRef<() => Promise<void>>(() => Promise.resolve());

  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      router.replace('/admin/login');
      return;
    }
    let cancelled = false;
    // admin:event 폭주 시 stats 재요청 스톰 방지 — 1.2s trailing debounce.
    let eventDebounce: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (eventDebounce) clearTimeout(eventDebounce);
      eventDebounce = setTimeout(() => void refresh.current(), 1200);
    };
    refresh.current = async () => {
      try {
        const s = await adminGetStats();
        if (!cancelled) setStats(s);
      } catch (e) {
        // 인증 만료(401)일 때만 로그인으로 — 일시적 네트워크 글리치로 튕기지 않게.
        if (e instanceof ApiError && e.status === 401) {
          router.replace('/admin/login');
        }
      }
    };
    refresh.current();

    const socket = getSocket();
    const onConnect = () => setLive(true);
    const onDisconnect = () => setLive(false);
    const onAdminEvent = (e: { type: string; ts: string; [k: string]: unknown }) => {
      setFeed((prev) =>
        [
          {
            id: `${e.ts}-${Math.random().toString(36).slice(2, 8)}`,
            ts: e.ts,
            type: e.type,
            label: formatAdminEvent(e),
          },
          ...prev,
        ].slice(0, FEED_MAX),
      );
      // 이벤트 들어오면 stats 도 갱신 — 디바운스로 폭주 시 묶어서 1회.
      scheduleRefresh();
    };
    if (socket.connected) onConnect();
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('admin:event', onAdminEvent);
    const stopAuth = joinAdminChannel(token);

    const id = setInterval(() => void refresh.current(), POLL_MS);
    return () => {
      cancelled = true;
      if (eventDebounce) clearTimeout(eventDebounce);
      clearInterval(id);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('admin:event', onAdminEvent);
      stopAuth();
    };
  }, [router]);

  function onCleanup() {
    if (daysNum < 1) {
      setError('며칠 이상을 지울지 입력해 주세요 (1 이상).');
      return;
    }
    setError(null);
    setCleanupConfirm(true);
  }

  async function doCleanup() {
    setBusy(true);
    setError(null);
    try {
      const r = await adminCleanup(daysNum);
      setCleanupResult(r.removed);
      setCleanupConfirm(false);
      void refresh.current();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onExportCsv() {
    try {
      await adminDownloadCsv(
        '/admin/rooms.csv',
        `whenever-rooms-${new Date().toISOString().slice(0, 10)}.csv`,
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!stats) {
    return <p className="text-sm text-zinc-500">불러오는 중…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">대시보드</h1>
          <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
            <span
              aria-hidden
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                live ? 'bg-emerald-500' : 'bg-zinc-400'
              }`}
            />
            {live ? 'LIVE' : '폴링'}
          </span>
        </div>
        <button
          type="button"
          onClick={onExportCsv}
          className="h-9 rounded-full border border-zinc-200 bg-white px-4 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          전체 방 CSV 내보내기
        </button>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="총 방" value={stats.totalRooms} />
        <Kpi label="총 참여자" value={stats.totalParticipants} />
        <Kpi label="총 투표" value={stats.totalVotes} />
        <Kpi label="방당 평균 참여자" value={stats.avgParticipantsPerRoom} />
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi label="활성 방" value={stats.activeRooms} accent="emerald" />
        <Kpi label="종료 방" value={stats.closedRooms} />
        <Kpi label="마감일 설정 방" value={stats.roomsWithDeadline} />
      </section>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartCard title="최근 30일 방 생성 추이">
          <DailyArea data={stats.dailyCreated} />
        </ChartCard>
        <ChartCard title="최근 30일 투표 추이">
          <DailyArea data={stats.dailyVotes} />
        </ChartCard>
      </section>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartCard title="요일별 인기 (후보 날짜 기준)">
          <WeeklyBar data={stats.weeklyVotes} />
        </ChartCard>
        <ChartCard title="시간대별 참여자 입장 (KST, 최근 30일)">
          <HourlyBar data={stats.hourlyJoins} />
        </ChartCard>
      </section>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card title="최근 7일 활성 Top 5">
          {stats.topActiveRooms.length === 0 ? (
            <EmptyState emoji="🌱" message="최근 7일 활성 방이 없어요" />
          ) : (
            <ul className="mt-1 flex flex-col gap-2">
              {stats.topActiveRooms.map((r, idx) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        idx === 0
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                          : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <Link
                      href={`/admin/rooms/${r.id}`}
                      className="truncate text-sm font-medium hover:underline"
                    >
                      {r.title}
                    </Link>
                  </div>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {r.participantCount}명
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="실시간 활동 피드">
          {feed.length === 0 && stats.recentActions.length === 0 ? (
            <EmptyState emoji="📭" message="아직 활동이 없어요" />
          ) : (
            <ul className="mt-1 flex flex-col gap-1.5">
              {(feed.length > 0
                ? feed
                : stats.recentActions.map((a) => ({
                    id: String(a.id),
                    ts: a.createdAt,
                    type: a.action,
                    label: formatActionLabel(a.action),
                  }))
              ).map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="truncate">{item.label}</span>
                  <span className="shrink-0 text-zinc-400">
                    {formatRelative(item.ts)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <Card title="방 정리 (운영자 전용)">
        <p className="text-xs text-zinc-500">
          입력한 일수보다 오래된 방을 일괄 삭제합니다 (CASCADE).
        </p>
        <div className="mt-3 flex items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={days}
            onChange={(e) =>
              setDays(
                e.target.value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, ''),
              )
            }
            className="h-10 w-24 rounded-lg border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <span className="text-sm text-zinc-500">일 이상</span>
          <button
            type="button"
            onClick={onCleanup}
            disabled={busy || daysNum < 1}
            className="ml-auto h-10 rounded-full bg-rose-600 px-4 text-sm font-medium text-white disabled:bg-zinc-300"
          >
            {busy ? '정리 중…' : '정리 실행'}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      </Card>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/rooms"
          className="inline-flex h-11 items-center rounded-full border border-zinc-300 px-5 text-sm dark:border-zinc-700"
        >
          방 목록으로 →
        </Link>
        <Link
          href="/admin/logs"
          className="inline-flex h-11 items-center rounded-full border border-zinc-300 px-5 text-sm dark:border-zinc-700"
        >
          액션 로그 →
        </Link>
      </div>

      <ConfirmModal
        open={cleanupConfirm}
        title="오래된 방 정리"
        message={`${daysNum}일 이상된 방을 한꺼번에 지울게요.\n계속할까요?`}
        confirmLabel="정리하기"
        danger
        busy={busy}
        onConfirm={() => void doCleanup()}
        onCancel={() => setCleanupConfirm(false)}
      />

      <ConfirmModal
        open={cleanupResult !== null}
        title="정리 끝났어요"
        message={`삭제된 방: ${cleanupResult ?? 0}개`}
        confirmLabel="확인"
        cancelLabel="닫기"
        onConfirm={() => setCleanupResult(null)}
        onCancel={() => setCleanupResult(null)}
      />
    </div>
  );
}

// ───────────── presentational ─────────────

function Kpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: 'emerald';
}) {
  const accentCls =
    accent === 'emerald'
      ? 'text-emerald-700 dark:text-emerald-300'
      : 'text-zinc-900 dark:text-zinc-100';
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accentCls}`}>{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-3 h-48">{children}</div>
    </section>
  );
}

// ───────────── charts ─────────────

function DailyArea({ data }: { data: { day: string; count: number }[] }) {
  const padded = useMemo(() => padDailySeries(data, 30), [data]);
  const hasData = data.some((d) => d.count > 0);
  if (!hasData) {
    return <EmptyState emoji="📊" message="데이터가 모이는 중이에요" />;
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={padded} margin={{ top: 4, right: 4, bottom: 4, left: -16 }}>
        <defs>
          <linearGradient id="amberFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#e4e4e7" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="day"
          tickFormatter={(d) => d.slice(5)}
          tick={{ fontSize: 11, fill: '#71717a' }}
          interval="preserveStartEnd"
        />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#71717a' }} />
        <Tooltip content={<ChartTooltip />} />
        <Area
          type="monotone"
          dataKey="count"
          stroke="#f59e0b"
          strokeWidth={2}
          fill="url(#amberFill)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

const DOW_LABELS = ['', '월', '화', '수', '목', '금', '토', '일'];

function WeeklyBar({ data }: { data: { dow: number; count: number }[] }) {
  const filled = useMemo(() => {
    const m = new Map(data.map((d) => [d.dow, d.count]));
    return Array.from({ length: 7 }, (_, i) => ({
      label: DOW_LABELS[i + 1],
      count: m.get(i + 1) ?? 0,
    }));
  }, [data]);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={filled} margin={{ top: 4, right: 4, bottom: 4, left: -16 }}>
        <CartesianGrid stroke="#e4e4e7" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#71717a' }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#71717a' }} />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function HourlyBar({ data }: { data: { hour: number; count: number }[] }) {
  const filled = useMemo(() => {
    const m = new Map(data.map((d) => [d.hour, d.count]));
    return Array.from({ length: 24 }, (_, i) => ({
      label: String(i).padStart(2, '0'),
      count: m.get(i) ?? 0,
    }));
  }, [data]);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={filled} margin={{ top: 4, right: 4, bottom: 4, left: -16 }}>
        <CartesianGrid stroke="#e4e4e7" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: '#71717a' }}
          interval={2}
        />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#71717a' }} />
        <Tooltip content={<ChartTooltip suffix="시" />} />
        <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  suffix,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string | number;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md bg-zinc-900 px-2 py-1 text-xs text-white shadow-md dark:bg-zinc-100 dark:text-zinc-900">
      <div className="font-medium">
        {label}
        {suffix ?? ''}
      </div>
      <div>{payload[0].value}</div>
    </div>
  );
}

// ───────────── helpers ─────────────

function padDailySeries(
  data: { day: string; count: number }[],
  days: number,
): { day: string; count: number }[] {
  // 마지막 N일을 항상 표시 (없는 날은 0). 그래프가 점점 자라는 느낌이 나도록.
  // 키는 KST 달력 날짜 — 서버 버킷(date_trunc AT TIME ZONE 'Asia/Seoul')과 일치시켜
  // UTC 자정~KST 자정 사이 하루 어긋남을 방지한다.
  const KST_OFFSET = 9 * 60 * 60 * 1000;
  const map = new Map(data.map((d) => [d.day, d.count]));
  const out: { day: string; count: number }[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86_400_000);
    const key = new Date(d.getTime() + KST_OFFSET).toISOString().slice(0, 10);
    out.push({ day: key, count: map.get(key) ?? 0 });
  }
  return out;
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  if (diff < 60_000) return '방금';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return `${Math.floor(diff / 86_400_000)}일 전`;
}

function formatAdminEvent(e: { type: string; [k: string]: unknown }): string {
  switch (e.type) {
    case 'room_created':
      return `🆕 새 방 "${e.title}" (${e.roomId})`;
    case 'participant_joined':
      return `👤 ${e.nickname} 가 ${e.roomId} 입장`;
    case 'deadline_updated':
      return `⏰ ${e.roomId} 마감 변경`;
    case 'room_deleted':
      return `🗑 ${e.roomId} 삭제`;
    case 'participant_kicked':
      return `🚫 ${e.nickname} 강퇴 (${e.roomId})`;
    default:
      return e.type;
  }
}

function formatActionLabel(action: string): string {
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
