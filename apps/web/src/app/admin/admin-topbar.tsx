'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearAdminToken, getAdminToken } from '@/lib/admin';

export default function AdminTopbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    // 로그인 토큰은 localStorage(클라이언트 전용)라 마운트/경로 변경 시 동기화한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasToken(!!getAdminToken());
  }, [pathname]);

  function logout() {
    clearAdminToken();
    router.replace('/admin/login');
  }

  if (pathname === '/admin/login') {
    return null;
  }

  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      {/* 네비 항목이 5개라 모바일에선 브랜드와 한 줄에 안 들어간다.
          브랜드는 shrink-0, 네비는 가로 스크롤(스크롤바 숨김)로 넘침을 흡수 —
          페이지 본문은 안 밀린다 (CLAUDE.md §2). */}
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-5">
        <Link href="/admin" className="shrink-0 text-sm font-semibold">
          모일까 어드민
        </Link>
        <nav className="flex flex-1 items-center justify-end gap-4 overflow-x-auto whitespace-nowrap text-sm text-zinc-600 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden dark:text-zinc-300">
          <Link href="/admin" className="shrink-0 hover:underline">
            대시보드
          </Link>
          <Link href="/admin/rooms" className="shrink-0 hover:underline">
            방 목록
          </Link>
          <Link href="/admin/visits" className="shrink-0 hover:underline">
            방문
          </Link>
          <Link href="/admin/activity" className="shrink-0 hover:underline">
            활동
          </Link>
          <Link href="/admin/notices" className="shrink-0 hover:underline">
            공지
          </Link>
          <Link href="/admin/logs" className="shrink-0 hover:underline">
            로그
          </Link>
          {hasToken && (
            <button
              type="button"
              onClick={logout}
              className="shrink-0 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              로그아웃
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
