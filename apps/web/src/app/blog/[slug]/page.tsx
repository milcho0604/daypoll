import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import BlogArticle from '@/components/blog/blog-article';
import PrivatePostGate from '@/components/blog/private-post-gate';
import {
  getAdjacentPosts,
  getAllPosts,
  getPost,
  getRelatedPosts,
} from '@/lib/blog';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://moilga.com';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getAllPosts({
    includePrivate: true,
    includeDrafts: !IS_PRODUCTION,
  }).map((post) => ({ slug: post.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post || (post.meta.draft && IS_PRODUCTION)) return {};
  if (post.meta.visibility === 'private') {
    return {
      title: '비공개 글 · 모일까',
      description: '운영자 인증이 필요한 비공개 글입니다.',
      robots: { index: false, follow: false, noarchive: true },
    };
  }

  const { meta } = post;
  const image = meta.cover ?? `/blog/${slug}/opengraph-image`;
  return {
    title: `${meta.title} · 모일까`,
    description: meta.description,
    keywords: [meta.category, ...meta.tags],
    category: meta.category,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      type: 'article',
      title: meta.title,
      description: meta.description,
      url: `/blog/${slug}`,
      publishedTime: `${meta.date}T00:00:00+09:00`,
      modifiedTime: `${meta.updated ?? meta.date}T00:00:00+09:00`,
      tags: meta.tags,
      images: [{ url: image, alt: meta.coverAlt ?? meta.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: meta.title,
      description: meta.description,
      images: [image],
    },
  };
}

export default async function BlogPostPage({ params }: Params) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post || (post.meta.draft && IS_PRODUCTION)) notFound();

  if (post.meta.visibility === 'private') {
    return <PrivatePostGate slug={slug} />;
  }

  const related = getRelatedPosts(slug);
  const adjacent = getAdjacentPosts(slug);
  const image = post.meta.cover
    ? new URL(post.meta.cover, SITE_URL).toString()
    : `${SITE_URL}/blog/${slug}/opengraph-image`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.meta.title,
    description: post.meta.description,
    image,
    datePublished: post.meta.date,
    dateModified: post.meta.updated ?? post.meta.date,
    mainEntityOfPage: `${SITE_URL}/blog/${slug}`,
    inLanguage: 'ko-KR',
    articleSection: post.meta.category,
    keywords: post.meta.tags.join(', '),
    author: { '@type': 'Organization', name: '모일까' },
    publisher: { '@type': 'Organization', name: '모일까', url: SITE_URL },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replaceAll('<', '\\u003c'),
        }}
      />
      <BlogArticle post={post} related={related} adjacent={adjacent} />
    </>
  );
}
