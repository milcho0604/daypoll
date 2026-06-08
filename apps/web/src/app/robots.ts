import type { MetadataRoute } from 'next';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://daypoll.vercel.app';

// /api : 백엔드 프록시. /admin : 운영 페이지. /rooms : 개인 모임 URL (개별 페이지에서
// metadata.robots 로도 명시했지만 크롤러가 거기까지 가지도 못하게 한 번 더 막는다).
// /rooms/new 는 검색 노출이 의미 있는 랜딩 — 별도 허용.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/rooms/new', '/privacy', '/terms'],
        disallow: ['/admin', '/api', '/rooms/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
