import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import BlogExplorer from '@/components/blog/blog-explorer';
import { getAllPosts, getBlogFacets } from '@/lib/blog';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://moilga.com';

export const metadata: Metadata = {
  title: '블로그 · 모일까',
  description: '모일까를 만들며 겪은 제품·인프라·개발 기록.',
  alternates: {
    canonical: '/blog',
    types: { 'application/rss+xml': '/blog/feed.xml' },
  },
  openGraph: {
    type: 'website',
    title: '블로그 · 모일까',
    description: '모일까를 만들며 겪은 제품·인프라·개발 기록.',
    url: '/blog',
  },
};

export default function BlogIndex() {
  const posts = getAllPosts();
  const facets = getBlogFacets();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: '모일까 블로그',
    description: '모일까를 만들며 겪은 제품·인프라·개발 기록.',
    url: `${SITE_URL}/blog`,
    inLanguage: 'ko-KR',
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: posts.map((post, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `${SITE_URL}/blog/${post.slug}`,
        name: post.title,
      })),
    },
  };

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-16 sm:pt-12 sm:pb-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replaceAll('<', '\\u003c'),
        }}
      />
      <header className="mb-8">
        <Link
          href="/"
          className="press inline-flex h-9 items-center rounded-full text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          ← 홈으로
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">블로그</h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              모일까를 만들며 겪은 제품·인프라·개발 기록.
            </p>
          </div>
          <a
            href="/blog/feed.xml"
            className="press inline-flex h-9 items-center rounded-full border border-zinc-200 bg-white px-3.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            RSS 구독
          </a>
        </div>
      </header>

      <Suspense
        fallback={
          <p className="py-8 text-center text-sm text-zinc-500">
            글 목록을 준비하고 있어요…
          </p>
        }
      >
        <BlogExplorer
          posts={posts}
          categories={facets.categories}
          tags={facets.tags}
        />
      </Suspense>
    </main>
  );
}
