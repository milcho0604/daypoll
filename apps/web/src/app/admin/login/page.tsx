'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { adminGetStats, setAdminToken } from '@/lib/admin';

export default function AdminLoginPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setAdminToken(token.trim());
      await adminGetStats(); // 검증
      router.replace('/admin');
    } catch {
      setError('토큰이 잘못됐어요.');
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-50 px-5 dark:bg-zinc-950">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h1 className="text-xl font-semibold">어드민 로그인</h1>
        <p className="mt-2 text-sm text-zinc-500">
          서버의 <code>ADMIN_TOKEN</code> 값을 입력하세요.
        </p>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          autoFocus
          placeholder="ADMIN_TOKEN"
          className="mt-4 h-12 w-full rounded-xl border border-zinc-200 bg-white px-3 text-base outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-100"
        />
        {error && (
          <p className="mt-3 text-sm text-rose-600 dark:text-rose-300">{error}</p>
        )}
        <button
          type="submit"
          disabled={busy || !token.trim()}
          className="mt-4 h-12 w-full rounded-full bg-zinc-900 text-base font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-white dark:text-zinc-900 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-500"
        >
          {busy ? '확인 중…' : '들어가기'}
        </button>
      </form>
    </main>
  );
}
