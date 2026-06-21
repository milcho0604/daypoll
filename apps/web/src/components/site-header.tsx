'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// 글로벌 상단 바 — 워드마크(=홈) + 새 투표 동선.
// footer 와 대칭되는 얇은 유리질 바. 콘텐츠를 누르지 않게 z-30 (모달 z-50 아래).
export default function SiteHeader() {
  const pathname = usePathname();

  // 어드민은 자체 AdminTopbar 가 있어 글로벌 헤더를 숨긴다 (상단 바 중복 방지).
  if (pathname?.startsWith('/admin')) return null;

  // 홈은 hero 의 "방 만들기" CTA 가 같은 역할이라 새 투표 칩은 생략 (중복 회피).
  const isHome = pathname === '/';

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-100 bg-white/70 pt-[env(safe-area-inset-top)] backdrop-blur dark:border-zinc-900 dark:bg-zinc-950/70">
      <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between px-5">
        <Link
          href="/"
          aria-label="언제모여 홈으로"
          className="press inline-flex items-center gap-1.5 text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
        >
          <span aria-hidden>🗓️</span>
          언제모여
        </Link>

        {!isHome && (
          <Link
            href="/rooms/new"
            className="press inline-flex h-9 items-center gap-1 rounded-full bg-zinc-900 px-3.5 text-xs font-medium text-white dark:bg-white dark:text-zinc-900"
          >
            <span aria-hidden>+</span>
            새 투표
          </Link>
        )}
      </div>
    </header>
  );
}
