'use client';

import type { PlaceResult } from '@whenever/shared';
import { PLACES_PER_ROOM_MAX } from '@whenever/shared';
import { useState } from 'react';
import CrownIcon from '@/components/icons/crown';
import EmptyState from '@/components/empty-state';
import PlaceForm, { type PlaceInput } from '@/components/room/place-form';
import { mapSearchLinks, providerOf, safeHref } from '@/lib/place-share';

export type { PlaceInput };

// 장소·메뉴 투표 — 날짜 투표와 같은 방에서 "동시에". 후보 목록이 곧 투표지이자 결과.
// 서버 호출은 room-view 가 한다 (이 컴포넌트는 그리기 + 입력 폼 상태만).
export default function PlaceSection({
  places,
  confirmedPlaceId,
  myPlaceIds,
  meId,
  joined,
  declined,
  locked,
  deadlinePassed,
  isCreator,
  onAdd,
  onEdit,
  onToggleVote,
  onDelete,
  onConfirm,
  onUnconfirm,
  onAnnounce,
  announceCopied,
  onShare,
  linkCopied,
}: {
  places: PlaceResult[];
  confirmedPlaceId: number | null;
  myPlaceIds: Set<number>;
  meId: number | null;
  joined: boolean;
  declined: boolean;
  locked: boolean; // 마감 지남 또는 장소 확정 (날짜 확정과는 무관)
  deadlinePassed: boolean;
  isCreator: boolean;
  onAdd: (input: PlaceInput) => Promise<string | null>; // 실패 메시지 또는 null
  onEdit: (placeId: number, input: PlaceInput) => Promise<string | null>;
  onToggleVote: (placeId: number) => void;
  onDelete: (place: PlaceResult) => void;
  onConfirm: (place: PlaceResult) => void;
  onUnconfirm: () => void;
  onAnnounce: () => void;
  announceCopied: boolean;
  onShare: () => void;
  linkCopied: boolean;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [justAdded, setJustAdded] = useState(false);

  const confirmed =
    confirmedPlaceId != null
      ? (places.find((p) => p.placeId === confirmedPlaceId) ?? null)
      : null;
  const maxVotes = places.reduce((m, p) => Math.max(m, p.votes), 0);
  const canWrite = joined && !declined && !locked;
  const full = places.length >= PLACES_PER_ROOM_MAX;

  return (
    <section id="places" className="mt-8 scroll-mt-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">어디서 모일까?</h2>
        {places.length > 0 && (
          <span className="text-xs text-zinc-400">
            후보 {places.length}/{PLACES_PER_ROOM_MAX}
          </span>
        )}
      </div>
      <p className="mt-1 text-balance break-keep text-sm text-zinc-500 dark:text-zinc-400">
        식당·카페·메뉴 뭐든 좋아요. 가고 싶은 곳은 여러 개 골라도 돼요.
      </p>

      {confirmed && (
        <div className="fade-up mt-3 rounded-2xl border border-amber-300 bg-white p-5 ring-1 ring-amber-200/60 dark:border-amber-700 dark:bg-zinc-900 dark:ring-amber-900/60">
          <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-amber-500 px-3.5 text-xs font-semibold text-white shadow-sm dark:bg-amber-600">
            <CrownIcon className="h-3.5 w-3.5" />
            장소 확정!
          </span>
          <p className="mt-3 break-words text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {confirmed.name}
          </p>
          {confirmed.memo && (
            <p className="mt-1 break-words text-sm text-zinc-500 dark:text-zinc-400">
              {confirmed.memo}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onAnnounce}
              className="press inline-flex h-10 items-center gap-1.5 rounded-full bg-zinc-900 px-4 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
            >
              {announceCopied ? '복사됨 ✓' : '📢 단톡방에 알리기'}
            </button>
            <PlaceLink url={confirmed.url} size="md" />
          </div>
          {isCreator && (
            <button
              type="button"
              onClick={onUnconfirm}
              className="press mt-3 text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              장소 확정 해제 (다시 고르기)
            </button>
          )}
        </div>
      )}

      {places.length === 0 ? (
        <EmptyState emoji="📍" message="아직 장소 후보가 없어요" />
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {places.map((p) => {
            const mine = myPlaceIds.has(p.placeId);
            const leading = !confirmed && maxVotes > 0 && p.votes === maxVotes;
            const isConfirmed = p.placeId === confirmedPlaceId;
            const canDelete =
              !locked && (isCreator || (meId != null && p.createdBy?.id === meId));
            if (editingId === p.placeId && canDelete) {
              return (
                <li key={p.placeId}>
                  <PlaceForm
                    initial={{
                      name: p.name,
                      url: p.url ?? '',
                      memo: p.memo ?? '',
                    }}
                    submitLabel="고치기"
                    busyLabel="고치는 중…"
                    onSubmit={async (input) => {
                      const err = await onEdit(p.placeId, input);
                      if (!err) setEditingId(null);
                      return err;
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                </li>
              );
            }
            return (
              <li
                key={p.placeId}
                className={`rounded-xl border bg-white p-3 dark:bg-zinc-900 ${
                  isConfirmed
                    ? 'border-amber-300 dark:border-amber-700'
                    : 'border-zinc-200 dark:border-zinc-800'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="break-words text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {p.name}
                      </p>
                      {leading && (
                        <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                          {deadlinePassed ? '1위' : '현재 1위'}
                        </span>
                      )}
                    </div>
                    {p.memo && (
                      <p className="mt-0.5 break-words text-xs text-zinc-500 dark:text-zinc-400">
                        {p.memo}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleVote(p.placeId)}
                    disabled={!canWrite}
                    aria-pressed={mine}
                    aria-label={`${p.name} ${mine ? '고른 것 취소' : '가고 싶어요'} (${p.votes}표)`}
                    className={`press inline-flex h-10 shrink-0 items-center gap-1 rounded-full px-3.5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                      mine
                        ? 'bg-zinc-900 text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900'
                        : 'border border-zinc-200 bg-white text-zinc-700 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200'
                    }`}
                  >
                    <span aria-hidden>👍</span>
                    {p.votes}
                  </button>
                </div>

                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className={`h-full transition-all duration-500 ${
                      leading
                        ? 'bg-amber-300 dark:bg-amber-400'
                        : 'bg-zinc-300 dark:bg-zinc-600'
                    }`}
                    style={{
                      width: `${maxVotes ? (p.votes / maxVotes) * 100 : 0}%`,
                    }}
                  />
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {p.url ? (
                    <PlaceLink url={p.url} size="sm" />
                  ) : (
                    // 링크 없는 후보도 한 번에 지도를 열 수 있게 — 이름으로 검색.
                    <a
                      href={mapSearchLinks(p.name)[0]?.href}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="press inline-flex h-9 items-center gap-1 rounded-full bg-zinc-100 px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    >
                      <span aria-hidden>🔎</span>지도에서 찾기
                      <span aria-hidden className="text-zinc-400">
                        ↗
                      </span>
                    </a>
                  )}
                  {p.voters.length > 0 && (
                    <span className="break-words text-xs text-zinc-500 dark:text-zinc-400">
                      {p.voters.map((v) => v.nickname).join(' · ')}
                    </span>
                  )}
                  {(canDelete || (isCreator && !confirmed)) && (
                    <span className="ml-auto flex items-center gap-3">
                      {/* amber 는 1위 한 곳에만 — 모든 줄에 금색 버튼이 서면 "드물게" 가 깨진다.
                          나머지 후보는 조용한 텍스트 링크로 (다른 곳으로 정하는 길은 열어둔다). */}
                      {isCreator && !confirmed && leading && (
                        <button
                          type="button"
                          onClick={() => onConfirm(p)}
                          className="press inline-flex h-9 items-center gap-1.5 rounded-full bg-amber-500 px-3.5 text-xs font-semibold text-white hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500"
                        >
                          <CrownIcon className="h-3.5 w-3.5" />이 곳으로 확정
                        </button>
                      )}
                      {isCreator && !confirmed && !leading && (
                        <button
                          type="button"
                          onClick={() => onConfirm(p)}
                          className="press text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-700 dark:hover:text-zinc-300"
                        >
                          이 곳으로 정하기
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(p.placeId);
                            setFormOpen(false);
                          }}
                          className="press text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-700 dark:hover:text-zinc-300"
                        >
                          고치기
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => onDelete(p)}
                          className="press text-xs text-zinc-400 underline underline-offset-2 hover:text-rose-600 dark:hover:text-rose-400"
                        >
                          지우기
                        </button>
                      )}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* 쓰기 불가 사유 — 버튼이 왜 안 눌리는지 말해준다 */}
      {!canWrite && !confirmed && (
        <p className="mt-3 rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          {deadlinePassed
            ? '투표가 마감됐어요. 방장이 장소를 정하면 여기에 떠요.'
            : declined
              ? '불참으로 표시돼 있어서 장소는 못 골라요. 다시 참여하면 골랐던 게 돌아와요.'
              : '위에서 이름을 적고 들어오면 후보를 올리고 고를 수 있어요.'}
        </p>
      )}

      {canWrite && justAdded && !formOpen && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-600 dark:text-zinc-300">
            올렸어요! 친구들도 보게 알려줄까요?
          </p>
          <button
            type="button"
            onClick={onShare}
            className="press inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-zinc-900 px-3.5 text-xs font-medium text-white dark:bg-white dark:text-zinc-900"
          >
            {linkCopied ? '복사됨 ✓' : '🔗 링크 공유'}
          </button>
        </div>
      )}

      {canWrite &&
        (full ? (
          <p className="mt-3 text-xs text-zinc-400">
            후보는 {PLACES_PER_ROOM_MAX}개까지예요. 안 되는 곳을 지우면 더 올릴 수 있어요.
          </p>
        ) : !formOpen ? (
          <button
            type="button"
            onClick={() => {
              setFormOpen(true);
              setEditingId(null);
              setJustAdded(false);
            }}
            className="press mt-3 flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-300 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <span aria-hidden>＋</span> 후보 올리기
          </button>
        ) : (
          <div className="mt-3">
            <PlaceForm
              submitLabel="올리기"
              busyLabel="올리는 중…"
              onSubmit={async (input) => {
                const err = await onAdd(input);
                if (!err) {
                  setFormOpen(false);
                  setJustAdded(true);
                }
                return err;
              }}
              onCancel={() => setFormOpen(false)}
            />
          </div>
        ))}
    </section>
  );
}

// 바로가기 — 호스트로 출처 라벨만 붙인다. 링크는 새 탭 + opener/referrer 차단.
function PlaceLink({ url, size }: { url: string | null; size: 'sm' | 'md' }) {
  const href = safeHref(url);
  if (!href) return null;
  const provider = providerOf(href);
  const icon = provider?.kind === 'map' ? '📍' : '🔗';
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={`press inline-flex max-w-full items-center gap-1 rounded-full bg-zinc-100 font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 ${
        size === 'md' ? 'h-10 px-4 text-sm' : 'h-9 px-3 text-xs'
      }`}
    >
      <span aria-hidden>{icon}</span>
      <span className="truncate">{provider?.label ?? '링크'}</span>
      <span aria-hidden className="text-zinc-400">
        ↗
      </span>
    </a>
  );
}
