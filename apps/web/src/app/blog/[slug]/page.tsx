import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAllPosts, getPost } from '@/lib/blog';

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  const { title, description } = post.meta;
  return {
    title: `${title} · 모일까`,
    description,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      type: 'article',
      title,
      description,
      url: `/blog/${slug}`,
    },
  };
}

export default async function BlogPostPage({ params }: Params) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-8 pb-16 sm:pt-12 sm:pb-20">
      <header className="mb-8">
        <Link
          href="/blog"
          className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          ← 블로그
        </Link>
        <h1 className="mt-2 text-2xl font-bold leading-snug tracking-tight">
          {post.meta.title}
        </h1>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          {post.meta.date}
        </p>
      </header>

      <article
        className="blog-prose"
        dangerouslySetInnerHTML={{ __html: post.html }}
      />
    </main>
  );
}
