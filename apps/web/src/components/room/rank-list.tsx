'use client';

import type { DateResult } from '@whenever/shared';
import { formatDateKR } from '@/lib/format';
import CrownIcon from '@/components/icons/crown';

// 날짜별 순위 — 막대 + 행 탭 시 투표자 펼침.
//
// 1위 강조는 "단색 amber 한 겹" 으로만 한다. 예전엔 카드 보더+ring+그라데이션 배지
// +🏆 이모지+그라데이션 바가 겹쳐 게임 보상 화면처럼 촌스러웠다 ("촌스럽다" 피드백).
// 촌스러움의 원인은 색이 아니라 **그라데이션·이모지·중첩** 이었으므로, 브랜드의
// 따뜻함(amber)은 남기고 장식만 걷어낸다 — CLAUDE.md §1-1.
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
                ? 'border-zinc-300 shadow-sm dark:border-zinc-600'
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
                    // 단색 amber 원 + 단색 왕관 SVG.
                    // 🏆 이모지는 OS 마다 다른 그림이 렌더되고 채도가 높아 zinc 톤에서 혼자 튄다.
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white dark:bg-amber-600">
                      <CrownIcon className="h-3.5 w-3.5" />
                    </span>
                  ) : (
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold leading-none text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {idx + 1}
                    </span>
                  )}
                  <span
                    className={`text-sm ${
                      winnerIds.has(r.dateId)
                        ? 'font-semibold text-zinc-900 dark:text-zinc-100'
                        : 'font-medium'
                    }`}
                  >
                    {formatDateKR(r.date)}
                  </span>
                  {winnerIds.has(r.dateId) && (
                    // 금색이 "우승 확정" 처럼 읽히던 문제를 색이 아니라 말로 해결한다.
                    <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                      현재 1위
                    </span>
                  )}
                  {hasToken && selected.has(r.dateId) && (
                    <span
                      title="내가 고른 날"
                      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-900 dark:bg-zinc-100"
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
                {/* 그라데이션 제거 — 얇은 바 위의 그라데는 낡은 progress-bar 클리셰다.
                    예전엔 1위=amber 그라데(채도 max) / 나머지=검정이라 바 언어가 불일치했다.
                    이제 단색으로 통일: 1위만 톤다운한 amber-300, 나머지는 연한 zinc.
                    amber-500 은 100% 꽉 차면 형광펜처럼 튀어서 한 단계 낮춘다. */}
                <div
                  className={`h-full transition-all duration-500 ${
                    winnerIds.has(r.dateId)
                      ? 'bg-amber-300 dark:bg-amber-400'
                      : 'bg-zinc-300 dark:bg-zinc-600'
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
