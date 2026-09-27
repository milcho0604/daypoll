'use client';

import { track } from '@vercel/analytics';

type EventProperties = Record<string, string | number | boolean>;

export function trackBlogEvent(
  name: string,
  properties: EventProperties = {},
): void {
  try {
    track(name, properties);
  } catch {
    // 분석 실패는 읽기·검색·공유 기능을 방해하지 않는다.
  }
}
