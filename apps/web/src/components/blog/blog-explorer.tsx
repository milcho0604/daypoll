'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useRef } from 'react';
import EmptyState from '@/components/empty-state';
import type { PostMeta } from '@/lib/blog-types';

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${date}T00:00:00+09:00`));
}

function normalize(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('ko-KR').trim();
}

export default function BlogExplorer({
  posts,
  categories,
  tags,
}: {
  posts: PostMeta[];
  categories: string[];
  tags: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get('q') ?? '';
  const category = searchParams.get('category') ?? '';
  const tag = searchParams.get('tag') ?? '';
  const searchInput = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const needle = normalize(urlQuery);
    return posts.filter((post) => {
      if (category && post.category !== category) return false;
      if (tag && !post.tags.includes(tag)) return false;
      if (!needle) return true;
      return normalize(
        [
          post.title,
          post.description,
          post.category,
          post.tags.join(' '),
        ].join(' '),
      ).includes(needle);
    });
  }, [category, posts, tag, urlQuery]);

  function updateUrl(next: {
    q?: string;
    category?: string;
    tag?: string;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const search = params.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, {
      scroll: false,
    });
  }

  function reset() {
    router.replace(pathname, { scroll: false });
  }

  const hasFilter = Boolean(urlQuery || category || tag);

  return (
    <section aria-label="블로그 글 탐색" className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            updateUrl({ q: searchInput.current?.value.trim() ?? '' });
          }}
          className="flex items-center gap-3"
        >
          <label htmlFor="blog-search" className="sr-only">
            블로그 글 검색
          </label>
          <input
            id="blog-search"
            key={urlQuery}
            ref={searchInput}
            type="search"
            defaultValue={urlQuery}
            placeholder="제목, 내용, 태그로 찾아보세요"
            className="h-12 min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/20"
          />
          <button
            type="submit"
            className="press h-12 shrink-0 rounded-full bg-zinc-900 px-5 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
          >
            찾기
          </button>
        </form>

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2" aria-label="카테고리 필터">
            <button
              type="button"
              onClick={() =>
                updateUrl({
                  category: '',
                  q: searchInput.current?.value.trim() ?? urlQuery,
                })
              }
              aria-pressed={!category}
              className={`press h-9 rounded-full px-3.5 text-xs font-medium ${
                !category
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                  : 'border border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
              }`}
            >
              전체
            </button>
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() =>
                  updateUrl({
                    category: item,
                    q: searchInput.current?.value.trim() ?? urlQuery,
                  })
                }
                aria-pressed={category === item}
                className={`press h-9 rounded-full px-3.5 text-xs font-medium ${
                  category === item
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                    : 'border border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        )}

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2" aria-label="태그 필터">
            {tags.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() =>
                  updateUrl({
                    tag: tag === item ? '' : item,
                    q: searchInput.current?.value.trim() ?? urlQuery,
                  })
                }
                aria-pressed={tag === item}
                className={`press h-9 rounded-full px-3 text-xs ${
                  tag === item
                    ? 'bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                }`}
              >
                #{item}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
        <p aria-live="polite">
          {hasFilter ? `${filtered.length}개의 글을 찾았어요` : `전체 ${posts.length}개`}
        </p>
        {hasFilter && (
          <button
            type="button"
            onClick={reset}
            className="press h-9 rounded-full px-3 font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            필터 지우기
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        posts.length === 0 ? (
          <EmptyState emoji="📋" message="아직 기록이 없어요" />
        ) : (
          <EmptyState emoji="🔍" message="조건에 맞는 글이 없네요" />
        )
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((post) => (
            <li key={post.slug}>
              <Link
                href={`/blog/${post.slug}`}
                aria-label={post.title}
                className="lift press block overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
              >
                {post.cover && (
                  <div className="relative aspect-[16/7] w-full overflow-hidden border-b border-zinc-100 dark:border-zinc-800">
                    <Image
                      src={post.cover}
                      alt={post.coverAlt ?? ''}
                      fill
                      sizes="(max-width: 672px) 100vw, 672px"
                      className="object-cover"
                    />
                  </div>
                )}
                <article className="p-5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      {post.category}
                    </span>
                    <span aria-hidden>·</span>
                    <time dateTime={post.date}>
                      {formatDate(post.date)}
                    </time>
                    {post.updated && post.updated !== post.date && (
                      <>
                        <span aria-hidden>·</span>
                        <span>수정 {formatDate(post.updated)}</span>
                      </>
                    )}
                    <span aria-hidden>·</span>
                    <span>약 {post.readingMinutes}분</span>
                  </div>
                  <h2 className="mt-2 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                    {post.title}
                  </h2>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                    {post.description}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2" aria-label="글 태그">
                    {post.tags.slice(0, 4).map((item) => (
                      <span
                        key={item}
                        className="inline-flex h-9 items-center rounded-full bg-zinc-100 px-3 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                      >
                        #{item}
                      </span>
                    ))}
                  </div>
                </article>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
