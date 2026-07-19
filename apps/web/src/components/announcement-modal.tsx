'use client';

import { useEffect, useRef, useState } from 'react';
import type { Notice } from '@whenever/shared';

function formatKST(iso: string): string {
  // 점검 예정 시각 — KST 로 "7월 20일 (월) 오전 12:00" 형태.
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// 메인 화면 공지 팝업. notice 는 서버(page.tsx)가 API 에서 받아 넘긴다.
// CLAUDE.md §4 다이얼로그 패턴 + 친근 톤.
//
// 동작:
// - "다시 보지 않기" → 이 공지(id)를 localStorage 에 기록, 다신 안 뜸.
// - "확인" / 배경 탭 / Esc → 이번만 닫음 (다음 방문에 다시 뜸).
// - 새 공지를 게시하면 id 가 바뀌므로, 예전 공지를 dismiss 했어도 새 공지는 다시 뜬다.
export default function AnnouncementModal({
  notice,
}: {
  notice: Notice | null;
}) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  // dismiss 키에 updatedAt 을 포함 → 공지를 수정/재게시(내용 변경)하면 키가 바뀌어,
  // 이미 "다시 보지 않기" 한 사람에게도 갱신된 공지가 다시 뜬다.
  const storageKey = notice
    ? `moilga_notice_seen:${notice.id}:${notice.updatedAt}`
    : '';

  // 마운트 시 dismiss 여부 확인 후 표시 (하이드레이션 mismatch 방지: 기본 닫힘).
  useEffect(() => {
    if (!notice) return;
    try {
      if (window.localStorage.getItem(storageKey)) return;
    } catch {
      // localStorage 접근 불가(프라이빗 모드 등) — 그냥 띄운다.
    }
    // localStorage(외부 시스템)를 읽어 표시 여부를 정하는 마운트 1회 동기화라
    // effect 안 setState 가 의도된 것 (repo 관례 — room-view 와 동일).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(true);
  }, [notice, storageKey]);

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!notice || !open) return null;

  const dismissForever = () => {
    try {
      window.localStorage.setItem(storageKey, '1');
    } catch {
      /* 저장 실패해도 닫기는 진행 */
    }
    setOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="notice-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="pop-in w-full max-w-sm rounded-t-2xl bg-white p-5 dark:bg-zinc-900 sm:rounded-2xl">
        <span className="inline-flex h-6 items-center rounded-full bg-zinc-100 px-2.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          공지
        </span>
        <h2
          id="notice-title"
          className="mt-2 text-lg font-bold text-zinc-900 dark:text-zinc-100"
        >
          {notice.title}
        </h2>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          {notice.body}
        </p>
        {notice.scheduledAt && (
          <p className="mt-3 rounded-lg bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            🗓️ 예정: {formatKST(notice.scheduledAt)}
          </p>
        )}
        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            onClick={dismissForever}
            className="press h-11 flex-1 rounded-xl border border-zinc-200 text-sm font-medium text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
          >
            다시 보지 않기
          </button>
          <button
            ref={closeRef}
            type="button"
            onClick={() => setOpen(false)}
            className="press h-11 flex-1 rounded-xl bg-zinc-900 text-sm font-semibold text-white dark:bg-white dark:text-zinc-900"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
