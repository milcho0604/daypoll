'use client';

import { useState } from 'react';
import { trackBlogEvent } from '@/lib/blog-analytics';

export default function ShareActions({
  title,
  slug,
}: {
  title: string;
  slug: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      trackBlogEvent('Blog Link Copied', { slug });
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function share() {
    if (!navigator.share) {
      await copyLink();
      return;
    }
    try {
      await navigator.share({ title, url: window.location.href });
      trackBlogEvent('Blog Shared', { slug });
    } catch {
      // 사용자가 공유 시트를 닫은 경우도 예외이므로 별도 오류 UI는 띄우지 않는다.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="글 공유">
      <button
        type="button"
        onClick={() => void copyLink()}
        className="press h-10 rounded-full border border-zinc-200 bg-white px-4 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        {copied ? '링크 복사됨' : '링크 복사'}
      </button>
      <button
        type="button"
        onClick={() => void share()}
        className="press h-10 rounded-full bg-zinc-900 px-4 text-xs font-medium text-white dark:bg-white dark:text-zinc-900"
      >
        공유하기
      </button>
    </div>
  );
}
