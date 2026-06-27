import Link from 'next/link';
import EmptyState from '@/components/empty-state';
import { getAllPosts } from '@/lib/blog';

export const metadata = {
  title: '블로그 · 모일까',
  description: '모일까를 만들며 겪은 인프라·개발 기록.',
  alternates: { canonical: '/blog' },
};

export default function BlogIndex() {
  const posts = getAllPosts();
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-16 sm:pt-12 sm:pb-20">
      <header className="mb-8">
        <Link
          href="/"
          className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          ← 홈으로
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">블로그</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          모일까를 만들며 겪은 인프라·개발 기록.
        </p>
      </header>

      {posts.length === 0 ? (
        <EmptyState emoji="📋" message="아직 기록이 없어요" />
      ) : (
        <ul className="flex flex-col gap-3">
          {posts.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/blog/${p.slug}`}
                className="lift press block rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <time className="text-xs text-zinc-400 dark:text-zinc-500">
                  {p.date}
                </time>
                <h2 className="mt-1 text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {p.title}
                </h2>
                {p.description && (
                  <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                    {p.description}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
