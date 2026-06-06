'use client';

import { useMemo, useState } from 'react';
import { DayPicker, type DateRange } from 'react-day-picker';
import { ko } from 'date-fns/locale';
import { addDays, endOfMonth, format, startOfMonth } from 'date-fns';
import 'react-day-picker/style.css';

type Mode = 'multiple' | 'range' | 'month';

function isoOf(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function fromIso(s: string): Date {
  // 'YYYY-MM-DD' 를 로컬 시간대 자정으로 파싱 (new Date('YYYY-MM-DD') 는 UTC 자정이라 KST 에선 하루 어긋날 수 있음)
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export interface DateBuilderProps {
  values: string[]; // YYYY-MM-DD
  onChange: (next: string[]) => void;
  max: number;
  minDate?: Date;
}

// 개설자 방 생성 화면용 — 개별/기간/달 단위 후보 날짜 묶음 선택.
// 다중 선택 결과는 항상 정렬된 YYYY-MM-DD 배열로 상위에 전달한다.
export default function DateBuilder({
  values,
  onChange,
  max,
  minDate,
}: DateBuilderProps) {
  const [mode, setMode] = useState<Mode>('multiple');
  const [month, setMonth] = useState<Date>(() => new Date());
  const [range, setRange] = useState<DateRange | undefined>();

  const selectedDates = useMemo(() => values.map(fromIso), [values]);
  const minOrToday = minDate ?? new Date(new Date().setHours(0, 0, 0, 0));

  function addDates(extra: Date[]) {
    const merged = new Set(values);
    for (const d of extra) {
      if (merged.size >= max) break;
      if (d.getTime() < minOrToday.getTime()) continue;
      merged.add(isoOf(d));
    }
    onChange(Array.from(merged).sort());
  }

  function removeOne(iso: string) {
    onChange(values.filter((v) => v !== iso));
  }

  function clearAll() {
    onChange([]);
  }

  function applyRange() {
    if (!range?.from || !range?.to) return;
    const dates: Date[] = [];
    const start = range.from < range.to ? range.from : range.to;
    const end = range.from < range.to ? range.to : range.from;
    for (let d = start; d.getTime() <= end.getTime(); d = addDays(d, 1)) {
      dates.push(d);
    }
    addDates(dates);
    setRange(undefined);
  }

  function applyMonth() {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const dates: Date[] = [];
    for (let d = start; d.getTime() <= end.getTime(); d = addDays(d, 1)) {
      dates.push(d);
    }
    addDates(dates);
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" className="flex gap-2 text-sm">
        {(
          [
            { key: 'multiple', label: '개별' },
            { key: 'range', label: '기간' },
            { key: 'month', label: '달 전체' },
          ] as { key: Mode; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={mode === t.key}
            onClick={() => setMode(t.key)}
            className={`h-9 rounded-full border px-3 ${
              mode === t.key
                ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900'
                : 'border-zinc-200 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
        {mode === 'multiple' && (
          <DayPicker
            mode="multiple"
            locale={ko}
            month={month}
            onMonthChange={setMonth}
            selected={selectedDates}
            onSelect={(arr) => onChange((arr ?? []).map(isoOf).sort())}
            disabled={{ before: minOrToday }}
            weekStartsOn={0}
            showOutsideDays
          />
        )}
        {mode === 'range' && (
          <>
            <DayPicker
              mode="range"
              locale={ko}
              month={month}
              onMonthChange={setMonth}
              selected={range}
              onSelect={setRange}
              disabled={{ before: minOrToday }}
              weekStartsOn={0}
              showOutsideDays
            />
            <div className="flex items-center justify-between gap-2 px-2 pb-2">
              <p className="text-xs text-zinc-500">
                {range?.from && range?.to
                  ? `${isoOf(range.from)} ~ ${isoOf(range.to)} 추가`
                  : '시작일과 종료일을 차례로 선택'}
              </p>
              <button
                type="button"
                onClick={applyRange}
                disabled={!range?.from || !range?.to}
                className="h-9 rounded-full bg-zinc-900 px-4 text-sm font-medium text-white disabled:bg-zinc-300 dark:bg-white dark:text-zinc-900 dark:disabled:bg-zinc-700"
              >
                기간 추가
              </button>
            </div>
          </>
        )}
        {mode === 'month' && (
          <>
            <DayPicker
              mode="single"
              locale={ko}
              month={month}
              onMonthChange={setMonth}
              selected={undefined}
              disabled
              weekStartsOn={0}
              showOutsideDays
            />
            <div className="flex items-center justify-between gap-2 px-2 pb-2">
              <p className="text-xs text-zinc-500">
                {format(month, 'yyyy년 M월', { locale: ko })} 전체 일자 추가
              </p>
              <button
                type="button"
                onClick={applyMonth}
                className="h-9 rounded-full bg-zinc-900 px-4 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
              >
                이 달 전체 추가
              </button>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>
          선택 {values.length} / {max}
        </span>
        {values.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="text-zinc-500 underline underline-offset-2 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            전체 비우기
          </button>
        )}
      </div>

      {values.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {values.map((d) => (
            <li key={d}>
              <button
                type="button"
                onClick={() => removeOne(d)}
                aria-label={`${d} 제거`}
                className="inline-flex h-9 items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 text-sm transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
              >
                <span>{d}</span>
                <span aria-hidden className="text-zinc-400">
                  ×
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
