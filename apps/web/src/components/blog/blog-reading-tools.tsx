'use client';

import { useEffect, useRef, useState } from 'react';
import { trackBlogEvent } from '@/lib/blog-analytics';

export default function BlogReadingTools({
  slug,
  trackEvents,
}: {
  slug: string;
  trackEvents: boolean;
}) {
  const [progress, setProgress] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const reached = useRef(new Set<number>());

  useEffect(() => {
    const article = document.querySelector<HTMLElement>('[data-blog-article]');
    if (!article) return;

    if (trackEvents) trackBlogEvent('Blog Viewed', { slug });

    let frame = 0;
    const update = () => {
      frame = 0;
      const start = article.offsetTop;
      const distance = Math.max(1, article.offsetHeight - window.innerHeight);
      const next = Math.min(1, Math.max(0, (window.scrollY - start) / distance));
      setProgress(next);
      if (trackEvents) {
        for (const threshold of [25, 50, 75, 100]) {
          if (next * 100 >= threshold && !reached.current.has(threshold)) {
            reached.current.add(threshold);
            trackBlogEvent('Blog Read Depth', { slug, percent: threshold });
          }
        }
      }
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    const cleanups: Array<() => void> = [];
    for (const pre of article.querySelectorAll<HTMLPreElement>('pre')) {
      const code = pre.querySelector('code');
      if (!code || pre.querySelector('.code-copy-button')) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'code-copy-button press';
      button.textContent = '복사';
      button.setAttribute('aria-label', '코드 복사');
      const copy = async () => {
        try {
          await navigator.clipboard.writeText(code.textContent ?? '');
          button.textContent = '복사됨';
          setAnnouncement('코드를 복사했습니다.');
          if (trackEvents) trackBlogEvent('Blog Code Copied', { slug });
          window.setTimeout(() => {
            button.textContent = '복사';
          }, 1_800);
        } catch {
          setAnnouncement('코드를 복사하지 못했습니다.');
        }
      };
      button.addEventListener('click', copy);
      pre.append(button);
      cleanups.push(() => {
        button.removeEventListener('click', copy);
        button.remove();
      });
    }

    for (const anchor of article.querySelectorAll<HTMLAnchorElement>(
      '.heading-anchor',
    )) {
      const copyHeading = async (event: Event) => {
        event.preventDefault();
        const href = anchor.getAttribute('href');
        if (!href) return;
        try {
          const url = new URL(href, window.location.href).toString();
          await navigator.clipboard.writeText(url);
          window.history.replaceState(null, '', href);
          setAnnouncement('제목 링크를 복사했습니다.');
          if (trackEvents) trackBlogEvent('Blog Heading Copied', { slug });
        } catch {
          setAnnouncement('제목 링크를 복사하지 못했습니다.');
        }
      };
      anchor.addEventListener('click', copyHeading);
      cleanups.push(() => anchor.removeEventListener('click', copyHeading));
    }

    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) window.cancelAnimationFrame(frame);
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [slug, trackEvents]);

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+3.5rem)] z-40 h-0.5 bg-transparent"
      >
        <div
          data-testid="reading-progress"
          className="h-full origin-left bg-amber-500 motion-reduce:transition-none"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      {progress >= 0.2 && (
        <button
          type="button"
          aria-label="글 맨 위로 이동"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="press fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 bg-white/95 text-sm font-semibold text-zinc-700 shadow-lg backdrop-blur hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          ↑
        </button>
      )}
    </>
  );
}
