'use client';

import type { DateResult } from '@whenever/shared';
import { formatDateKR } from '@/lib/format';

// 날짜별 순위 — 막대 + 행 탭 시 투표자 펼침. 1위(들) 트로피/amber.
export default function RankList({
  results,
  maxVotes,
  winnerIds,
  expandedDates,
  onToggleExpanded,
  selected,
  hasToken,
  isCreator,
  onKick,
  showAll,
  onToggleShowAll,
  preview,
}: {
  results: DateResult[];
  maxVotes: number;
  winnerIds: Set<number>;
  expandedDates: Set<number>;
  onToggleExpanded: (id: number) => void;
  selected: Set<number>;
  hasToken: boolean;
  isCreator: boolean;
  onKick: (id: number, nickname: string) => void;
  showAll: boolean;
  onToggleShowAll: () => void;
  preview: number;
}) {
  const visible = showAll ? results : results.slice(0, preview);
  return (
    <>
      <ol className="mt-3 flex flex-col gap-2">
        {visible.map((r, idx) => (
          <li
            key={r.dateId}
            className={`lift overflow-hidden rounded-xl border bg-white transition-colors dark:bg-zinc-900 ${
              winnerIds.has(r.dateId)
                ? 'border-amber-300 ring-1 ring-amber-200/60 dark:border-amber-700 dark:ring-amber-900/60'
                : 'border-zinc-200 dark:border-zinc-800'
            }`}
          >
            {/* 행 전체 탭 → 누가 투표했는지 펼침 */}
            <button
              type="button"
              onClick={() => onToggleExpanded(r.dateId)}
              aria-expanded={expandedDates.has(r.dateId)}
              className="press w-full p-3 text-left"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {winnerIds.has(r.dateId) ? (
                    // 이모지 글리프가 박스 위쪽으로 치우치는 경향 — leading-none + pt 미세 보정으로 광학적 정렬.
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-[15px] leading-none shadow-sm">
                      <span className="block translate-y-[0.5px]">🏆</span>
                    </span>
                  ) : (
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold leading-none text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {idx + 1}
                    </span>
                  )}
                  <span className="text-sm font-medium">
                    {formatDateKR(r.date)}
                  </span>
                  {hasToken && selected.has(r.dateId) && (
                    <span
                      title="내가 고른 날"
                      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                    />
                  )}
                </div>
                <span className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                  <span>
                    <strong className="text-zinc-900 dark:text-zinc-100">
                      {r.votes}
                    </strong>
                    표
                  </span>
                  <span
                    aria-hidden
                    className={`text-[10px] text-zinc-400 transition-transform ${
                      expandedDates.has(r.dateId) ? 'rotate-180' : ''
                    }`}
                  >
                    ▾
                  </span>
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div
                  className={`h-full transition-all duration-500 ${
                    winnerIds.has(r.dateId)
                      ? 'bg-gradient-to-r from-amber-400 to-amber-600'
                      : 'bg-zinc-900 dark:bg-zinc-100'
                  }`}
                  style={{
                    width: `${maxVotes ? (r.votes / maxVotes) * 100 : 0}%`,
                  }}
                />
              </div>
            </button>
            {expandedDates.has(r.dateId) && (
              <div className="px-3 pb-3">
                {r.voters && r.voters.length > 0 ? (
                  // 참여자 많아도 행이 무한정 길어지지 않게 높이 제한 + 스크롤
                  <ul className="flex max-h-32 flex-wrap gap-1 overflow-y-auto pr-1">
                    {r.voters.map((v) => (
                      <li key={v.id}>
                        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                          {v.nickname}
                          {isCreator && (
                            <button
                              type="button"
                              onClick={() => onKick(v.id, v.nickname)}
                              aria-label={`${v.nickname} 내보내기`}
                              className="press ml-0.5 text-zinc-400 hover:text-rose-600"
                            >
                              ×
                            </button>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-zinc-400">아직 아무도 안 골랐어요</p>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
      {results.length > preview && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={onToggleShowAll}
            aria-expanded={showAll}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <span>
              {showAll ? '접기' : `더 보기 (+${results.length - preview})`}
            </span>
            <span
              aria-hidden
              className={`text-[10px] transition-transform ${
                showAll ? 'rotate-180' : ''
              }`}
            >
              ▾
            </span>
          </button>
        </div>
      )}
    </>
  );
}
