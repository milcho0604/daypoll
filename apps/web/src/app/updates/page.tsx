import Link from 'next/link';
import { UPDATES } from '@/lib/updates';

export const metadata = {
  title: '업데이트 소식 · 모일까',
  description: '모일까에 새로 생긴 기능과 달라진 점.',
};

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${y}년 ${m}월 ${d}일`;
}

export default function UpdatesPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-16 sm:pt-12 sm:pb-20">
      <header className="mb-8">
        <Link
          href="/"
          className="press text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          ← 홈으로
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">업데이트 소식</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          모일까에 새로 생긴 것, 달라진 것이에요.
        </p>
      </header>

      <ol className="flex flex-col gap-6">
        {UPDATES.map((u, i) => (
          <li
            key={u.version}
            className={`rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 ${
              i === 0 ? 'fade-up' : ''
            }`}
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex h-9 items-center rounded-full bg-zinc-100 px-2.5 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                v{u.version}
              </span>
              <time dateTime={u.date} className="text-xs text-zinc-500 dark:text-zinc-400">
                {formatDate(u.date)}
              </time>
              {i === 0 && (
                <span className="inline-flex h-9 items-center rounded-full bg-emerald-50 px-2.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  최신
                </span>
              )}
            </div>
            <h2 className="mt-3 break-keep text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {u.title}
            </h2>
            <ul className="mt-2 flex flex-col gap-1.5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              {u.items.map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden className="text-zinc-400">
                    ·
                  </span>
                  <span className="break-keep">{item}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <p className="mt-8 text-xs text-zinc-400">
        개발 변경 이력 전체는{' '}
        <a
          href="https://github.com/milcho0604/daypoll/blob/main/CHANGELOG.md"
          target="_blank"
          rel="noopener noreferrer"
          className="press underline underline-offset-2 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          CHANGELOG
        </a>
        {' · '}
        <a
          href="https://github.com/milcho0604/daypoll/releases"
          target="_blank"
          rel="noopener noreferrer"
          className="press underline underline-offset-2 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          GitHub 릴리스
        </a>
        에 있어요.
      </p>
    </main>
  );
}
