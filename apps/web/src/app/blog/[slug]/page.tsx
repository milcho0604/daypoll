import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import BlogArticle from '@/components/blog/blog-article';
import PrivatePostGate from '@/components/blog/private-post-gate';
import {
  getAdjacentPosts,
  getAllPosts,
  getPost,
  getRelatedPosts,
  isPostPubliclyVisible,
} from '@/lib/blog';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://moilga.com';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

type Params = { params: Promise<{ slug: string }> };

function publicationTimes(meta: {
  date: string;
  updated?: string;
  publishAt?: string;
}): { published: string; modified: string } {
  const published = meta.publishAt ?? `${meta.date}T00:00:00+09:00`;
  const updated = meta.updated
    ? `${meta.updated}T00:00:00+09:00`
    : published;
  return {
    published,
    modified:
      new Date(updated).getTime() >= new Date(published).getTime()
        ? updated
        : published,
  };
}

export function generateStaticParams() {
  return getAllPosts({
    includePrivate: true,
    includeDrafts: !IS_PRODUCTION,
  }).map((post) => ({ slug: post.slug }));
}

// 예약 발행 글은 빌드 시점에 경로가 없어도 발행 시각 이후 처음 요청에서 생성한다.
export const dynamicParams = true;
export const revalidate = 60;

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
  if (!isPostPubliclyVisible(post)) return {};

  const { meta } = post;
  const times = publicationTimes(meta);
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
      publishedTime: times.published,
      modifiedTime: times.modified,
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
  if (!isPostPubliclyVisible(post)) notFound();

  const related = getRelatedPosts(slug);
  const adjacent = getAdjacentPosts(slug);
  const image = post.meta.cover
    ? new URL(post.meta.cover, SITE_URL).toString()
    : `${SITE_URL}/blog/${slug}/opengraph-image`;
  const times = publicationTimes(post.meta);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.meta.title,
    description: post.meta.description,
    image,
    datePublished: times.published,
    dateModified: times.modified,
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
