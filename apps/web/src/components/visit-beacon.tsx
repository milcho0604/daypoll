'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { apiBaseUrl } from '@/lib/api';

// 페이지 로드 시 방문 1회를 API 에 알린다 (어드민 집계용).
// PII 없음 — 경로만. 어드민 페이지는 운영자라 집계에서 제외.
export default function VisitBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname || pathname.startsWith('/admin')) return;
    // 유입 경로 분류용 힌트. referrer 원본은 서버가 저장하지 않고 coarse 라벨로만 분류.
    // utm_source/ref 는 카카오톡 공유처럼 referrer 가 빈 경우를 잡는 보조 힌트.
    let referrer: string | undefined;
    let ref: string | undefined;
    try {
      referrer = document.referrer || undefined;
      const q = new URLSearchParams(window.location.search);
      ref = q.get('utm_source') || q.get('ref') || undefined;
    } catch {
      /* 무시 */
    }
    // fire-and-forget. keepalive 로 페이지 이탈 중에도 전송, 실패는 무시.
    try {
      fetch(`${apiBaseUrl}/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: pathname, referrer, ref }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* 무시 */
    }
  }, [pathname]);
  return null;
}
