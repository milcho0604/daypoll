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
    // fire-and-forget. keepalive 로 페이지 이탈 중에도 전송, 실패는 무시.
    try {
      fetch(`${apiBaseUrl}/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: pathname }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* 무시 */
    }
  }, [pathname]);
  return null;
}
