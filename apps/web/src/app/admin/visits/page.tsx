'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { VisitDetail, VisitPathRow } from '@whenever/shared';
import { adminVisitsDetail, getAdminToken } from '@/lib/admin';
import { ApiError } from '@/lib/api';
import EmptyState from '@/components/empty-state';

type SortKey = 'today' | 'last7Days' | 'last30Days' | 'allTime';

export default function AdminVisitsPage() {
  const router = useRouter();
  const [data, setData] = useState<VisitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('allTime');

  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      router.replace('/admin/login');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const d = await adminVisitsDetail();
        if (!cancelled) setData(d);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          router.replace('/admin/login');
          return;
        }
        if (!cancelled) setError('방문 데이터를 불러오지 못했어요.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const sortedPaths = useMemo(() => {
    if (!data) return [];
    return [...data.paths].sort((a, b) => b[sort] - a[sort]);
  }, [data, sort]);

  if (loading) {
    return <p className="text-sm text-zinc-500">불러오는 중…</p>;
  }
  if (error || !data) {
    return <p className="text-sm text-rose-600">{error ?? '데이터 없음'}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">방문 (접속)</h1>
          <p className="mt-1 text-xs text-zinc-500">
            방 참여 안 한 방문까지 포함 · 개인정보 없이 경로·날짜별 카운트만
          </p>
        </div>
        <Link
          href="/admin"
          className="h-9 rounded-full border border-zinc-200 bg-white px-4 text-xs font-medium leading-9 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          ← 대시보드
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="오늘" value={data.today} />
        <Kpi label="최근 7일" value={data.last7Days} />
        <Kpi label="최근 30일" value={data.last30Days} />
        <Kpi label="전체 누적" value={data.allTime} />
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold">최근 90일 방문 추이</h2>
        <div className="mt-3 h-56">
          {data.daily.some((d) => d.count > 0) ? (
            <DailyArea data={data.daily} />
          ) : (
            <EmptyState emoji="📊" message="데이터가 모이는 중이에요" />
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">경로별 방문</h2>
          <span className="text-[11px] text-zinc-400">
            서로 다른 경로 {data.distinctPaths}개
          </span>
        </div>
        {sortedPaths.length === 0 ? (
          <div className="mt-3">
            <EmptyState emoji="📊" message="데이터가 모이는 중이에요" />
          </div>
        ) : (
          // 표는 좁은 폭에서 가로 스크롤(자체 컨테이너) — 본문은 안 밀린다 (§2).
          <div className="mt-3 -mx-2 overflow-x-auto">
            <table className="w-full min-w-[26rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800">
                  <th className="px-2 py-2 font-medium">경로</th>
                  <SortTh label="오늘" k="today" sort={sort} onSort={setSort} />
                  <SortTh label="7일" k="last7Days" sort={sort} onSort={setSort} />
                  <SortTh
                    label="30일"
                    k="last30Days"
                    sort={sort}
                    onSort={setSort}
                  />
                  <SortTh
                    label="전체"
                    k="allTime"
                    sort={sort}
                    onSort={setSort}
                  />
                </tr>
              </thead>
              <tbody>
                {sortedPaths.map((p) => (
                  <PathRow key={p.path} row={p} active={sort} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function SortTh({
  label,
  k,
  sort,
  onSort,
}: {
  label: string;
  k: SortKey;
  sort: SortKey;
  onSort: (k: SortKey) => void;
}) {
  const active = sort === k;
  return (
    <th className="px-2 py-2 text-right font-medium">
      <button
        type="button"
        onClick={() => onSort(k)}
        className={`press tabular-nums ${
          active ? 'text-zinc-900 underline dark:text-zinc-100' : 'hover:underline'
        }`}
      >
        {label}
        {active ? ' ↓' : ''}
      </button>
    </th>
  );
}

function PathRow({ row, active }: { row: VisitPathRow; active: SortKey }) {
  const cell = (k: SortKey, v: number) => (
    <td
      className={`px-2 py-2 text-right tabular-nums ${
        active === k
          ? 'font-semibold text-zinc-900 dark:text-zinc-100'
          : 'text-zinc-500'
      }`}
    >
      {v}
    </td>
  );
  return (
    <tr className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
      <td className="px-2 py-2">
        <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
          {row.path}
        </span>
      </td>
      {cell('today', row.today)}
      {cell('last7Days', row.last7Days)}
      {cell('last30Days', row.last30Days)}
      {cell('allTime', row.allTime)}
    </tr>
  );
}

function DailyArea({ data }: { data: { day: string; count: number }[] }) {
  const padded = useMemo(() => padDailySeries(data, 90), [data]);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={padded} margin={{ top: 4, right: 4, bottom: 4, left: -16 }}>
        <defs>
          <linearGradient id="visitAmberFill" x1="0" y1="0" x2="0" y2="1">
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
          minTickGap={24}
        />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#71717a' }} />
        <Tooltip content={<ChartTooltip />} />
        <Area
          type="monotone"
          dataKey="count"
          stroke="#f59e0b"
          strokeWidth={2}
          fill="url(#visitAmberFill)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md bg-zinc-900 px-2 py-1 text-xs text-white shadow-md dark:bg-zinc-100 dark:text-zinc-900">
      <div className="font-medium">{label}</div>
      <div>{payload[0].value}</div>
    </div>
  );
}

function padDailySeries(
  data: { day: string; count: number }[],
  days: number,
): { day: string; count: number }[] {
  // 마지막 N일을 항상 표시(없는 날은 0). 키는 KST 달력 날짜 — 서버 버킷과 일치.
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
