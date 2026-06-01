import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 py-12 text-center">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">언제모여</h1>
        <p className="mx-auto max-w-md text-zinc-600 dark:text-zinc-400">
          회원가입 없이 링크 하나로 친구들이랑 모일 날짜를 정해보세요.
        </p>
      </div>
      <Link
        href="/rooms/new"
        className="inline-flex h-12 items-center rounded-full bg-zinc-900 px-6 text-base font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        방 만들기
      </Link>
      <p className="text-xs text-zinc-400">v0.0.1 · 부트스트랩 확인용 페이지</p>
    </main>
  );
}
