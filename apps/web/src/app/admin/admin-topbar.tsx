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
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-5">
        <Link href="/admin" className="text-sm font-semibold">
          언제모여 어드민
        </Link>
        <nav className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-300">
          <Link href="/admin" className="hover:underline">
            대시보드
          </Link>
          <Link href="/admin/rooms" className="hover:underline">
            방 목록
          </Link>
          <Link href="/admin/logs" className="hover:underline">
            로그
          </Link>
          {hasToken && (
            <button
              type="button"
              onClick={logout}
              className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              로그아웃
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
