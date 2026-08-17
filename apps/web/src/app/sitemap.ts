import type { MetadataRoute } from 'next';
import { getAllPosts } from '@/lib/blog';
import { latestPostModifiedDate } from '@/lib/blog-core';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://moilga.com';

// 검색 노출이 의미 있는 정적 페이지만 등록. 개별 방 URL 은 robots 로 막아둠.
// lastModified 는 빌드 타임 기준 — Next 가 직렬화한다. 정적 페이지라 자주 안 바뀜.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const posts = getAllPosts();
  const latestModified = latestPostModifiedDate(posts);
  // 파서가 날짜 형식을 검증하지만 런타임 직렬화도 방어적으로 폴백한다.
  const safeDate = (s: string): Date => {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? now : d;
  };
  return [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/rooms/new`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/blog`,
      lastModified: latestModified ? safeDate(latestModified) : now,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    ...posts.map((p) => ({
      url: `${SITE_URL}/blog/${p.slug}`,
      lastModified: safeDate(p.updated ?? p.date),
      changeFrequency: 'yearly' as const,
      priority: 0.5,
    })),
    {
      url: `${SITE_URL}/privacy`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.2,
    },
  ];
}
