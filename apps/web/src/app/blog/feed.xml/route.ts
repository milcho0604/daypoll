import { getAllPosts } from '@/lib/blog';
import { latestPostModifiedDate } from '@/lib/blog-core';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://moilga.com';

export const dynamic = 'force-static';
export const revalidate = 60;

function xml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function rssDate(date: string): string {
  if (date.includes('T')) return new Date(date).toUTCString();
  return new Date(`${date}T00:00:00+09:00`).toUTCString();
}

export function GET() {
  const posts = getAllPosts();
  const latestModified = latestPostModifiedDate(posts);
  const lastBuildDate = latestModified
    ? rssDate(latestModified)
    : new Date(0).toUTCString();
  const items = posts
    .map((post) => {
      const url = `${SITE_URL}/blog/${post.slug}`;
      return `
    <item>
      <title>${xml(post.title)}</title>
      <link>${xml(url)}</link>
      <guid isPermaLink="true">${xml(url)}</guid>
      <description>${xml(post.description)}</description>
      <pubDate>${rssDate(post.publishAt ?? post.date)}</pubDate>
      <category>${xml(post.category)}</category>
      ${post.tags.map((tag) => `<category>${xml(tag)}</category>`).join('\n      ')}
    </item>`;
    })
    .join('');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>모일까 블로그</title>
    <link>${xml(`${SITE_URL}/blog`)}</link>
    <description>모일까를 만들며 겪은 제품·인프라·개발 기록.</description>
    <language>ko-KR</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${xml(`${SITE_URL}/blog/feed.xml`)}" rel="self" type="application/rss+xml" />${items}
  </channel>
</rss>`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300',
    },
  });
}
