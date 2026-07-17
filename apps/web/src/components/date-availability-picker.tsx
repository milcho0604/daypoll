'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { ko } from 'date-fns/locale';
import type { VoteStatus } from '@whenever/shared';
import EmptyState from './empty-state';
import 'react-day-picker/style.css';

function fromIso(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 미정은 Map 에 키가 없는 것으로 표현 → null 이 곧 미정.
export type PickState = VoteStatus | null;

// 탭 순환: 미정 → 가능 → 불가능 → 미정.
// "좋은 날 한 번 탭" 이라는 기존 습관이 그대로 가능(1탭)에 남게 하는 순서.
export function nextState(cur: PickState): PickState {
  if (cur == null) return 'yes';
  if (cur === 'yes') return 'no';
  return null;
}

export interface DateAvailabilityPickerProps {
  candidates: { id: number; date: string }[];
  // 없는 키 = 미정
  picks: Map<number, VoteStatus>;
  // 탭 — 순환
  onCycle: (id: number) => void;
  // 드래그 페인트 — 순환이 아니라 특정 상태로 확정
  onSet: (id: number, status: PickState) => void;
  // 빠른 선택 칩이 통째로 바꿀 때 사용. 없으면 칩 숨김.
  onBulkSet?: (ids: number[], status: PickState) => void;
  disabled?: boolean;
}

// 참여자 방 화면용 — 후보 날짜만 클릭 가능한 캘린더.
// 드래그(또는 모바일 길게-누르고-스와이프)로 여러 셀을 한 번에 칠함 — "이번 주 평일 다 가능"
// 같은 케이스에서 5번 탭이 1번 드래그로 줄어든다.
export default function DateAvailabilityPicker({
  candidates,
  picks,
  onCycle,
  onSet,
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
  // 라이브러리의 selected 스타일은 '가능'에만. '불가능'은 우리 클래스로만 그린다
  // (둘 다 selected 로 주면 rdp 기본 배경과 rose 배경이 겹쳐 싸운다).
  const selectedDates = useMemo(() => {
    const out: Date[] = [];
    for (const c of candidates)
      if (picks.get(c.id) === 'yes') out.push(fromIso(c.date));
    return out;
  }, [candidates, picks]);

  const initialMonth =
    candidates.length > 0 ? fromIso(candidates[0].date) : new Date();
  const [month, setMonth] = useState<Date>(initialMonth);

  // 드래그 상태. 처음 누른 셀이 순환으로 도달한 상태를 이후 셀 전부에 그대로 칠한다.
  const dragging = useRef(false);
  const dragMode = useRef<PickState>(null);
  const dragTouched = useRef<Set<number>>(new Set());

  const handlePointer = useCallback(
    (id: number, type: 'down' | 'enter') => {
      if (disabled) return;
      if (type === 'down') {
        dragging.current = true;
        dragMode.current = nextState(picks.get(id) ?? null);
        dragTouched.current = new Set([id]);
        onCycle(id);
      } else if (dragging.current && !dragTouched.current.has(id)) {
        const cur = picks.get(id) ?? null;
        // 이미 그 상태면 건너뛰기 (drag 흐름에서 되돌리지 않게)
        if (cur !== dragMode.current) {
          dragTouched.current.add(id);
          onSet(id, dragMode.current);
        }
      }
    },
    [disabled, picks, onCycle, onSet],
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

  const chipCls =
    'press h-9 rounded-full border border-zinc-200 bg-zinc-50 px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700';

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
              onClick={() => onBulkSet(weekendIds, 'yes')}
              className={chipCls}
            >
              주말만
            </button>
          )}
          {weekdayIds.length > 0 && (
            <button
              type="button"
              onClick={() => onBulkSet(weekdayIds, 'yes')}
              className={chipCls}
            >
              평일만
            </button>
          )}
          <button
            type="button"
            onClick={() => onBulkSet(allIds, 'yes')}
            className={chipCls}
          >
            다 가능
          </button>
          {picks.size > 0 && (
            <button
              type="button"
              onClick={() => onBulkSet(allIds, null)}
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
        disabled={disabled ? () => true : (d) => !idByIso.has(isoOf(d))}
        modifiers={{ candidate: candidateDates }}
        modifiersClassNames={{
          candidate: 'font-semibold underline decoration-2 underline-offset-4',
        }}
        components={{
          DayButton: function CustomDayBtn(p) {
            const iso = isoOf(p.day.date);
            const id = idByIso.get(iso);
            // 후보 외 셀은 원래 disabled 라 그대로 둠 (default click handler).
            // 후보 셀만 onClick 을 끄고, pointer 이벤트로 직접 처리 → drag 동작.
            if (id == null) {
              return <button {...p} />;
            }
            // 시각 강조는 button 자체에 직접 — 셀에 깔면 사각 블록처럼 보여 촌스러움.
            // 가능=zinc-900 (amber 는 트로피·1등·확정 hot path 한정, CLAUDE.md §1),
            // 불가능=rose (danger 토큰). 두 상태 모두 명도 차가 커서 색각 이상에도 구분됨.
            const state = picks.get(id) ?? null;
            const pickedCls =
              state === 'yes'
                ? 'rounded-full bg-zinc-900 font-bold text-white no-underline shadow-lg shadow-zinc-900/30 ring-2 ring-zinc-300 dark:bg-zinc-100 dark:text-zinc-900 dark:ring-zinc-700 dark:shadow-zinc-100/20'
                : state === 'no'
                  ? 'rounded-full bg-rose-600 font-bold text-white no-underline shadow-lg shadow-rose-600/30 ring-2 ring-rose-200 dark:bg-rose-500 dark:ring-rose-900'
                  : '';
            return (
              <button
                {...p}
                aria-label={`${iso} ${state === 'yes' ? '가능' : state === 'no' ? '불가능' : '미정'}`}
                className={`${p.className ?? ''} ${pickedCls}`.trim()}
                onClick={(e) => e.preventDefault()}
                onPointerDown={(e) => {
                  e.preventDefault();
                  // 클릭 가능한 곳만 잡음 — 이미 disabled 셀 제외
                  (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 pb-1 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-zinc-900 dark:bg-zinc-100" />
          가능
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-rose-600 dark:bg-rose-500" />
          못 가요
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full border border-zinc-300 dark:border-zinc-600" />
          미정
        </span>
      </div>
      <p className="px-2 pb-2 text-xs text-zinc-400">
        누를 때마다 <strong>가능 → 못 가요 → 미정</strong> 순으로 바뀌어요.{' '}
        <strong>드래그</strong>하면 여러 날 한 번에.
      </p>
    </div>
  );
}
