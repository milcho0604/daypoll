'use client';

import { useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { ko } from 'date-fns/locale';
import { format } from 'date-fns';
import 'react-day-picker/style.css';

// 마감 시각 고르기 — 브라우저 기본 <input type="datetime-local"> 대신.
//
// 기본 위젯은 폰·브라우저마다 제멋대로 그려진다 (iOS 가운데 정렬 텍스트, 안드로이드
// 달력 아이콘, 삼성 인터넷 화살표 겹침 등) — "화살표가 깨져 보인다" 는 제보.
// 앱이 이미 쓰는 달력(DayPicker, zinc 테마) + 우리가 그린 시간 드롭다운으로 바꿔
// 어디서나 같은 모양으로 보이게 한다.
//
// 값 형식은 datetime-local 과 같은 로컬 "YYYY-MM-DDTHH:mm" — 호출부 변경 없이 교체.

const pad = (n: number) => String(n).padStart(2, '0');

function parse(value: string): { date: Date; time: string } {
  const [d = '', t = '23:59'] = value.split('T');
  const [y, m, day] = d.split('-').map(Number);
  const date = new Date(y, m - 1, day);
  if (Number.isNaN(date.getTime())) {
    // 빈 값·깨진 값이면 내일 하루 끝으로 보여준다 (화면이 죽지 않게).
    const t2 = new Date();
    t2.setDate(t2.getDate() + 1);
    t2.setHours(0, 0, 0, 0);
    return { date: t2, time: '23:59' };
  }
  return { date, time: /^\d{2}:\d{2}/.test(t) ? t.slice(0, 5) : '23:59' };
}

// 30분 간격 + 하루 끝(23:59). 기존 값이 목록에 없으면(예: 14:07) 그 값도 넣는다.
const TIMES = [
  ...Array.from({ length: 48 }, (_, i) => `${pad(Math.floor(i / 2))}:${i % 2 ? '30' : '00'}`),
  '23:59',
];

export function timeLabel(t: string): string {
  const [h, m] = t.split(':').map(Number);
  if (h === 23 && m === 59) return '밤 11:59 (그날 끝)';
  if (h === 0 && m === 0) return '자정 12:00';
  if (h === 12 && m === 0) return '정오 12:00';
  const ampm = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${h12}:${pad(m)}`;
}

export function deadlineSummary(value: string): string {
  const { date, time } = parse(value);
  return `${format(date, 'M월 d일 (EEE)', { locale: ko })} ${timeLabel(time)}까지`;
}

export default function DeadlinePicker({
  value,
  onChange,
}: {
  value: string; // "YYYY-MM-DDTHH:mm" (로컬)
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { date, time } = parse(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const times = TIMES.includes(time) ? TIMES : [...TIMES, time].sort();
  const dateStr = format(date, 'yyyy-MM-dd');

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="press flex h-12 w-full items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 text-left text-base outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/40 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/40"
      >
        <span className="flex min-w-0 items-center gap-2">
          {/* 📅 이모지는 애플 기기에서 "JUL 17" 달력 그림이라 엉뚱한 날짜처럼 읽힌다 */}
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            className="h-4 w-4 shrink-0 text-zinc-500"
          >
            <rect x="3" y="4.5" width="14" height="12.5" rx="2" />
            <path d="M3 8.5h14M7 3v3M13 3v3" />
          </svg>
          <span className="truncate">{deadlineSummary(value)}</span>
        </span>
        <Chevron open={open} />
      </button>

      {open && (
        <div className="fade-up flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
          <DayPicker
            mode="single"
            locale={ko}
            required
            selected={date}
            defaultMonth={date}
            onSelect={(d) => d && onChange(`${format(d, 'yyyy-MM-dd')}T${time}`)}
            disabled={{ before: today }}
            weekStartsOn={0}
            showOutsideDays
          />
          <div className="flex items-center gap-3 px-2 pb-2">
            <label htmlFor="deadline-time" className="shrink-0 text-sm text-zinc-500">
              시간
            </label>
            <div className="relative flex-1">
              <select
                id="deadline-time"
                value={time}
                onChange={(e) => onChange(`${dateStr}T${e.target.value}`)}
                className="h-12 w-full appearance-none rounded-xl border border-zinc-200 bg-white pl-4 pr-10 text-base outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-100"
              >
                {times.map((t) => (
                  <option key={t} value={t}>
                    {timeLabel(t)}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                <Chevron open={false} />
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path d="m5 8 5 5 5-5" />
    </svg>
  );
}
