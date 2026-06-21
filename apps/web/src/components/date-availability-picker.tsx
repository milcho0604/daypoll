'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { ko } from 'date-fns/locale';
import EmptyState from './empty-state';
import 'react-day-picker/style.css';

function fromIso(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface DateAvailabilityPickerProps {
  candidates: { id: number; date: string }[];
  selectedIds: Set<number>;
  onToggle: (id: number) => void;
  // 빠른 선택 칩이 통째로 set 을 바꿀 때 사용. 없으면 칩 숨김.
  onBulkSet?: (ids: number[]) => void;
  disabled?: boolean;
}

// 참여자 방 화면용 — 후보 날짜만 클릭 가능한 캘린더.
// 드래그(또는 모바일 길게-누르고-스와이프)로 여러 셀을 한 번에 토글 — "이번 주 평일 다 가능"
// 같은 케이스에서 5번 탭이 1번 드래그로 줄어든다.
export default function DateAvailabilityPicker({
  candidates,
  selectedIds,
  onToggle,
  onBulkSet,
  disabled,
}: DateAvailabilityPickerProps) {
  const idByIso = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of candidates) map.set(c.date, c.id);
    return map;
  }, [candidates]);

  const candidateDates = useMemo(
    () => candidates.map((c) => fromIso(c.date)),
    [candidates],
  );
  const selectedDates = useMemo(() => {
    const out: Date[] = [];
    for (const c of candidates) if (selectedIds.has(c.id)) out.push(fromIso(c.date));
    return out;
  }, [candidates, selectedIds]);

  const initialMonth =
    candidates.length > 0 ? fromIso(candidates[0].date) : new Date();
  const [month, setMonth] = useState<Date>(initialMonth);

  // 드래그 상태. dragMode: true=가능 표시, false=가능 해제 — 처음 누른 셀의 반대 상태를 모든 셀에 적용.
  const dragging = useRef(false);
  const dragMode = useRef<'set' | 'unset' | null>(null);
  const dragTouched = useRef<Set<number>>(new Set());

  const handlePointer = useCallback(
    (id: number, type: 'down' | 'enter') => {
      if (disabled) return;
      if (type === 'down') {
        dragging.current = true;
        dragMode.current = selectedIds.has(id) ? 'unset' : 'set';
        dragTouched.current = new Set([id]);
        onToggle(id);
      } else if (dragging.current && !dragTouched.current.has(id)) {
        const currentlySelected = selectedIds.has(id);
        const shouldSelect = dragMode.current === 'set';
        // 이미 그 상태면 건너뛰기 (drag 흐름에서 토글 되돌리지 않게)
        if (currentlySelected !== shouldSelect) {
          dragTouched.current.add(id);
          onToggle(id);
        }
      }
    },
    [disabled, selectedIds, onToggle],
  );

  const endDrag = useCallback(() => {
    dragging.current = false;
    dragMode.current = null;
    dragTouched.current.clear();
  }, []);

  // 빠른 선택 칩 — 모바일 한 손 사용. 흔한 케이스 (주말만 / 평일만) 가 1탭.
  const weekendIds = useMemo(
    () =>
      candidates
        .filter((c) => {
          const d = fromIso(c.date).getDay();
          return d === 0 || d === 6;
        })
        .map((c) => c.id),
    [candidates],
  );
  const weekdayIds = useMemo(
    () =>
      candidates
        .filter((c) => {
          const d = fromIso(c.date).getDay();
          return d >= 1 && d <= 5;
        })
        .map((c) => c.id),
    [candidates],
  );
  const allIds = useMemo(() => candidates.map((c) => c.id), [candidates]);

  if (candidates.length === 0) {
    return (
      <EmptyState
        emoji="📅"
        message="아직 후보 날짜가 없어요"
        className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      />
    );
  }

  return (
    <div
      className="mt-3 select-none rounded-2xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900"
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      onPointerCancel={endDrag}
    >
      {onBulkSet && !disabled && (
        <div className="flex flex-wrap gap-1.5 px-2 pt-2">
          {weekendIds.length > 0 && (
            <button
              type="button"
              onClick={() => onBulkSet(weekendIds)}
              className="press h-9 rounded-full border border-zinc-200 bg-zinc-50 px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              주말만
            </button>
          )}
          {weekdayIds.length > 0 && (
            <button
              type="button"
              onClick={() => onBulkSet(weekdayIds)}
              className="press h-9 rounded-full border border-zinc-200 bg-zinc-50 px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              평일만
            </button>
          )}
          <button
            type="button"
            onClick={() => onBulkSet(allIds)}
            className="press h-9 rounded-full border border-zinc-200 bg-zinc-50 px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            다 가능
          </button>
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={() => onBulkSet([])}
              className="press h-9 rounded-full border border-zinc-200 px-3 text-xs font-medium text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              초기화
            </button>
          )}
        </div>
      )}
      <DayPicker
        mode="multiple"
        locale={ko}
        month={month}
        onMonthChange={setMonth}
        selected={selectedDates}
        disabled={
          disabled
            ? () => true
            : (d) => !idByIso.has(isoOf(d))
        }
        modifiers={{ candidate: candidateDates }}
        modifiersClassNames={{
          candidate: 'font-semibold underline decoration-2 underline-offset-4',
        }}
        components={{
          DayButton: function CustomDayBtn(p) {
            const iso = isoOf(p.day.date);
            const id = idByIso.get(iso);
            // 후보 외 셀은 원래 disabled 라 그대로 둠 (default click handler).
            // 후보 셀만 onClick 을 끄고, pointer 이벤트로 직접 토글 → drag 동작.
            if (id == null) {
              return <button {...p} />;
            }
            // 시각 강조는 button 자체에 직접 — 셀에 깔면 사각 블록처럼 보여 촌스러움.
            // zinc-900 강조: amber 는 트로피·1등·확정 hot path 한정 (CLAUDE.md §1).
            const isPicked = selectedIds.has(id);
            const pickedCls = isPicked
              ? 'rounded-full bg-zinc-900 font-bold text-white no-underline shadow-lg shadow-zinc-900/30 ring-2 ring-zinc-300 dark:bg-zinc-100 dark:text-zinc-900 dark:ring-zinc-700 dark:shadow-zinc-100/20'
              : '';
            return (
              <button
                {...p}
                className={`${p.className ?? ''} ${pickedCls}`.trim()}
                onClick={(e) => e.preventDefault()}
                onPointerDown={(e) => {
                  e.preventDefault();
                  // 클릭 가능한 곳만 잡음 — 이미 disabled 셀 제외
                  (e.target as HTMLElement).releasePointerCapture?.(
                    e.pointerId,
                  );
                  handlePointer(id, 'down');
                }}
                onPointerEnter={() => handlePointer(id, 'enter')}
              />
            );
          },
        }}
        weekStartsOn={0}
        showOutsideDays
      />
      <p className="px-2 pb-2 text-xs text-zinc-500">
        후보일을 누르거나 <strong>드래그</strong>로 여러 날을 한 번에 토글.
      </p>
    </div>
  );
}
