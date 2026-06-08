'use client';

import { useMemo, useState } from 'react';
import { DayPicker, type DateRange } from 'react-day-picker';
import { ko } from 'date-fns/locale';
import { addDays, addMonths, endOfMonth, format, startOfMonth } from 'date-fns';
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

const WEEKDAYS_KR = ['일', '월', '화', '수', '목', '금', '토'];
function shortChip(iso: string): string {
  // 'YYYY-MM-DD' → '6/13 (토)' — 칩에서 좁은 폭에 더 잘 들어감 + 요일 정보도 살림.
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${m}/${d} (${WEEKDAYS_KR[dt.getDay()]})`;
}

export interface DateBuilderProps {
  values: string[]; // YYYY-MM-DD
  onChange: (next: string[]) => void;
  max: number;
  minDate?: Date;
}

// 개설자 방 생성 화면용 — 개별/기간/달 단위 후보 날짜 묶음 선택.
// 다중 선택 결과는 항상 정렬된 YYYY-MM-DD 배열로 상위에 전달한다.
// 3 cols grid 라 3 배수가 깔끔 — 9개까지 다 보임, 10개 이상부터 "더 보기"
const CHIP_PREVIEW = 9;

export default function DateBuilder({
  values,
  onChange,
  max,
  minDate,
}: DateBuilderProps) {
  const [mode, setMode] = useState<Mode>('multiple');
  const [month, setMonth] = useState<Date>(() => new Date());
  const [range, setRange] = useState<DateRange | undefined>();
  const [showAllChips, setShowAllChips] = useState(false);

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
    const effectiveStart =
      start.getTime() < minOrToday.getTime() ? minOrToday : start;
    const dates: Date[] = [];
    for (let d = effectiveStart; d.getTime() <= end.getTime(); d = addDays(d, 1)) {
      dates.push(d);
    }
    addDates(dates);
  }

  const isPastMonth = endOfMonth(month).getTime() < minOrToday.getTime();
  const effectiveStart = (() => {
    const s = startOfMonth(month);
    return s.getTime() < minOrToday.getTime() ? minOrToday : s;
  })();
  const monthDayCount = isPastMonth
    ? 0
    : Math.floor(
        (endOfMonth(month).getTime() - effectiveStart.getTime()) / 86400000,
      ) + 1;

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
          <div className="flex flex-col items-center gap-4 px-2 py-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMonth(addMonths(month, -1))}
                aria-label="이전 달"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-base text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                ‹
              </button>
              <span className="min-w-[6.5rem] text-center text-base font-semibold">
                {format(month, 'yyyy년 M월', { locale: ko })}
              </span>
              <button
                type="button"
                onClick={() => setMonth(addMonths(month, 1))}
                aria-label="다음 달"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-base text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                ›
              </button>
            </div>
            <p className="text-center text-xs text-zinc-500">
              {isPastMonth
                ? '지난 달은 추가할 수 없습니다.'
                : `${format(effectiveStart, 'M월 d일', { locale: ko })} ~ ${format(
                    endOfMonth(month),
                    'M월 d일',
                    { locale: ko },
                  )} (${monthDayCount}일) 추가`}
            </p>
            <button
              type="button"
              onClick={applyMonth}
              disabled={isPastMonth || monthDayCount === 0}
              className="h-10 rounded-full bg-zinc-900 px-5 text-sm font-medium text-white disabled:bg-zinc-300 dark:bg-white dark:text-zinc-900 dark:disabled:bg-zinc-700"
            >
              이 달 전체 추가
            </button>
          </div>
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
        <>
          <ul className="grid grid-cols-3 gap-1.5">
            {(showAllChips ? values : values.slice(0, CHIP_PREVIEW)).map((d) => (
              <li key={d}>
                <button
                  type="button"
                  onClick={() => removeOne(d)}
                  aria-label={`${d} 제거`}
                  className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3 text-xs font-medium transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                >
                  <span>{shortChip(d)}</span>
                  <span aria-hidden className="text-zinc-400">
                    ×
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {values.length > CHIP_PREVIEW && (
            <div className="mt-1 flex justify-center">
              <button
                type="button"
                onClick={() => setShowAllChips((v) => !v)}
                aria-expanded={showAllChips}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <span>
                  {showAllChips
                    ? '접기'
                    : `더 보기 (+${values.length - CHIP_PREVIEW})`}
                </span>
                <span
                  aria-hidden
                  className={`text-[10px] transition-transform ${
                    showAllChips ? 'rotate-180' : ''
                  }`}
                >
                  ▾
                </span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
