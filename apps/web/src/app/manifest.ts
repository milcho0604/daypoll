import type { MetadataRoute } from 'next';

// PWA manifest — "홈 화면에 추가" 시 앱처럼 동작.
// 자체 아이콘은 app/icon.tsx / app/apple-icon.tsx 가 동적 생성.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '언제모여 — 회원가입 없이 날짜 맞추기',
    short_name: '언제모여',
    description: '친구들이랑 모일 날짜, 회원가입 없이 링크 하나로.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#f59e0b',
    orientation: 'portrait',
    lang: 'ko-KR',
    categories: ['social', 'productivity', 'lifestyle'],
    icons: [
      { src: '/icon', sizes: '192x192', type: 'image/png' },
      { src: '/icon', sizes: '512x512', type: 'image/png' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
