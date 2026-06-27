'use client';

import { useEffect, useState } from 'react';
import type { RegionCode, RoomWeather } from '@whenever/shared';
import { getRoomWeather } from '@/lib/rooms';
import { formatDateKR } from '@/lib/format';

// 후보 날짜 날씨 — 방에 지역이 설정된 경우에만. 예보 범위(약 2주) 밖 날짜는 빠진다.
// 날씨는 부가 정보라 실패하면 조용히 사라진다 (방 화면은 영향 없음).
export default function WeatherStrip({
  roomId,
  region,
}: {
  roomId: string;
  region: RegionCode | null | undefined;
}) {
  const [data, setData] = useState<RoomWeather | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!region) {
      // 지역 해제 시 이전 날씨/에러 초기화 — region 은 거의 안 바뀌어 cascading 아님
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(null);
      setFailed(false);
      return;
    }
    let cancelled = false;
    const ctrl = new AbortController();
    getRoomWeather(roomId, ctrl.signal)
      .then((w) => {
        if (!cancelled) setData(w);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [roomId, region]);

  if (!region || failed) return null;

  return (
    <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">
          <span aria-hidden>📍</span> {data?.regionLabel ?? ''} 날씨
        </h2>
        <span className="text-[11px] text-zinc-400">2주 이내 후보일</span>
      </div>

      {!data ? (
        <div className="mt-3 flex flex-col gap-2">
          <div className="h-10 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-10 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
        </div>
      ) : data.days.length === 0 ? (
        <p className="mt-3 rounded-xl bg-zinc-100 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          후보 날짜가 아직 예보 범위(약 2주) 밖이에요. 날짜가 가까워지면 자동으로 보여드릴게요.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {data.days.map((d) => (
            <li
              key={d.date}
              className="flex h-11 items-center justify-between rounded-xl bg-zinc-50 px-3 dark:bg-zinc-800/50"
            >
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {formatDateKR(d.date)}
              </span>
              <span className="flex items-center gap-2 text-sm">
                <span aria-hidden className="text-base">
                  {d.emoji}
                </span>
                <span className="text-zinc-500 dark:text-zinc-400">{d.label}</span>
                {(d.tempMin !== null || d.tempMax !== null) && (
                  <span className="tabular-nums text-zinc-400 dark:text-zinc-500">
                    {d.tempMin ?? '–'}° / {d.tempMax ?? '–'}°
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
