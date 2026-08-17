import Image from 'next/image';
import Link from 'next/link';
import ShareActions from './share-actions';
import type { AdjacentPosts, BlogPost, PostMeta } from '@/lib/blog-types';

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${date}T00:00:00+09:00`));
}

export default function BlogArticle({
  post,
  related = [],
  adjacent = { newer: null, older: null },
  privateMode = false,
}: {
  post: BlogPost;
  related?: PostMeta[];
  adjacent?: AdjacentPosts;
  privateMode?: boolean;
}) {
  const { meta } = post;
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-16 [overflow-wrap:anywhere] sm:pt-12 sm:pb-20">
      <header className="mb-8">
        <Link
          href="/blog"
          className="press inline-flex h-9 items-center rounded-full text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          ← 블로그
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex h-9 items-center rounded-full bg-zinc-100 px-3 font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {meta.category}
          </span>
          {privateMode && (
            <span className="inline-flex h-9 items-center rounded-full border border-zinc-300 px-3 font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
              비공개
            </span>
          )}
          {meta.draft && (
            <span className="inline-flex h-9 items-center rounded-full border border-zinc-300 px-3 font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
              초안
            </span>
          )}
        </div>
        <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          {meta.title}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
          {meta.description}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
          <time dateTime={meta.date}>{formatDate(meta.date)}</time>
          {meta.updated && meta.updated !== meta.date && (
            <>
              <span aria-hidden>·</span>
              <span>수정 {formatDate(meta.updated)}</span>
            </>
          )}
          <span aria-hidden>·</span>
          <span>약 {meta.readingMinutes}분</span>
          <span aria-hidden>·</span>
          <span>{meta.wordCount.toLocaleString('ko-KR')}단어</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2" aria-label="글 태그">
          {meta.tags.map((tag) => (
            <Link
              key={tag}
              href={`/blog?tag=${encodeURIComponent(tag)}`}
              className="press inline-flex h-9 items-center rounded-full bg-zinc-100 px-3 text-xs text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              #{tag}
            </Link>
          ))}
        </div>
      </header>

      {meta.cover && (
        <figure className="relative mb-8 aspect-[16/9] overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
          <Image
            src={meta.cover}
            alt={meta.coverAlt ?? ''}
            fill
            priority
            sizes="(max-width: 672px) 100vw, 672px"
            className="object-cover"
          />
        </figure>
      )}

      {post.toc.length >= 2 && (
        <nav
          aria-label="글 목차"
          className="mb-8 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <details open className="group">
            <summary className="press -m-2 flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl p-2 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 dark:hover:bg-zinc-800/70 [&::-webkit-details-marker]:hidden">
              <h2 className="text-sm font-semibold">이 글에서 다루는 내용</h2>
              <span
                aria-hidden="true"
                className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400"
              >
                <span className="group-open:hidden">펼치기</span>
                <span className="hidden group-open:inline">접기</span>
                <span className="inline-block transition-transform group-open:rotate-180 motion-reduce:transition-none">
                  ▾
                </span>
              </span>
            </summary>
            <ol className="mt-5 hidden flex-col gap-2 text-sm text-zinc-600 group-open:flex dark:text-zinc-400">
              {post.toc.map((item) => (
                <li
                  key={item.id}
                  className={item.level === 3 ? 'pl-4' : ''}
                >
                  <a
                    href={`#${item.id}`}
                    className="hover:text-zinc-900 hover:underline hover:underline-offset-2 dark:hover:text-zinc-100"
                  >
                    {item.title}
                  </a>
                </li>
              ))}
            </ol>
          </details>
        </nav>
      )}

      <article
        className="blog-prose"
        dangerouslySetInnerHTML={{ __html: post.html }}
      />

      {!privateMode && (
        <section className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <p className="text-sm font-medium">도움이 됐다면 같이 나눠주세요.</p>
          <ShareActions title={meta.title} />
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-12" aria-labelledby="related-posts">
          <h2 id="related-posts" className="text-lg font-semibold">
            이어서 읽기
          </h2>
          <ul className="mt-3 flex flex-col gap-3">
            {related.map((item) => (
              <li key={item.slug}>
                <Link
                  href={`/blog/${item.slug}`}
                  className="lift press block rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <p className="text-xs text-zinc-500">{item.category}</p>
                  <h3 className="mt-1 text-sm font-semibold">{item.title}</h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                    {item.description}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(adjacent.newer || adjacent.older) && (
        <nav
          aria-label="이전 글과 다음 글"
          className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          {adjacent.older ? (
            <Link
              href={`/blog/${adjacent.older.slug}`}
              className="press rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <span className="text-xs text-zinc-500">← 이전 글</span>
              <span className="mt-1 block text-sm font-medium">
                {adjacent.older.title}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {adjacent.newer && (
            <Link
              href={`/blog/${adjacent.newer.slug}`}
              className="press rounded-2xl border border-zinc-200 bg-white p-5 text-right dark:border-zinc-800 dark:bg-zinc-900"
            >
              <span className="text-xs text-zinc-500">다음 글 →</span>
              <span className="mt-1 block text-sm font-medium">
                {adjacent.newer.title}
              </span>
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}
