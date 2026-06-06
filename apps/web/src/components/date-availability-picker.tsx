'use client';

import { useMemo, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { ko } from 'date-fns/locale';
import 'react-day-picker/style.css';

function fromIso(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export interface DateAvailabilityPickerProps {
  // 후보 날짜들. id 는 서버 room_date.id, date 는 'YYYY-MM-DD'.
  candidates: { id: number; date: string }[];
  selectedIds: Set<number>;
  onToggle: (id: number) => void;
  disabled?: boolean;
}

// 참여자 방 화면용 — 후보 날짜만 클릭 가능한 캘린더.
// 후보가 아닌 셀은 disabled, 후보인 셀은 토글로 본인 가능/불가 표시.
export default function DateAvailabilityPicker({
  candidates,
  selectedIds,
  onToggle,
  disabled,
}: DateAvailabilityPickerProps) {
  const idByIso = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of candidates) map.set(c.date, c.id);
    return map;
  }, [candidates]);

  const candidateDates = useMemo(() => candidates.map((c) => fromIso(c.date)), [candidates]);
  const selectedDates = useMemo(() => {
    const out: Date[] = [];
    for (const c of candidates) if (selectedIds.has(c.id)) out.push(fromIso(c.date));
    return out;
  }, [candidates, selectedIds]);

  const initialMonth = candidates.length > 0 ? fromIso(candidates[0].date) : new Date();
  const [month, setMonth] = useState<Date>(initialMonth);

  if (candidates.length === 0) {
    return <p className="mt-3 text-sm text-zinc-500">후보 날짜가 없습니다.</p>;
  }

  return (
    <div className="mt-3 rounded-2xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
      <DayPicker
        mode="multiple"
        locale={ko}
        month={month}
        onMonthChange={setMonth}
        selected={selectedDates}
        onDayClick={(d) => {
          const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          const id = idByIso.get(iso);
          if (id != null) onToggle(id);
        }}
        // 후보 외 모든 날 + 마감 상태이면 전부 비활성화
        disabled={
          disabled
            ? () => true
            : (d) => {
                const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                return !idByIso.has(iso);
              }
        }
        modifiers={{ candidate: candidateDates }}
        modifiersClassNames={{
          // 후보일은 굵게 + 밑줄로만 표시. selected 의 둥근 배경과 시각적으로 겹치지 않도록.
          candidate: 'font-semibold underline decoration-2 underline-offset-4',
        }}
        weekStartsOn={0}
        showOutsideDays
      />
      <p className="px-2 pb-2 text-xs text-zinc-500">
        테두리가 표시된 날만 후보. 셀을 눌러 가능/불가 토글.
      </p>
    </div>
  );
}
