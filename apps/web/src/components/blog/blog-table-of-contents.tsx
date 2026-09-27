'use client';

import { useEffect, useState } from 'react';
import { trackBlogEvent } from '@/lib/blog-analytics';
import type { TocItem } from '@/lib/blog-types';

export default function BlogTableOfContents({
  toc,
  trackEvents,
}: {
  toc: TocItem[];
  trackEvents: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [activeId, setActiveId] = useState(toc[0]?.id ?? '');

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let current = toc[0]?.id ?? '';
      for (const item of toc) {
        const heading = document.getElementById(item.id);
        if (!heading) continue;
        if (heading.getBoundingClientRect().top <= 112) current = item.id;
        else break;
      }
      if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 4
      ) {
        current = toc.at(-1)?.id ?? current;
      }
      setActiveId(current);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [toc]);

  return (
    <nav
      aria-label="글 목차"
      className="mb-8 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <details
        open={open}
        className="group"
        onToggle={(event) => {
          const nextOpen = event.currentTarget.open;
          setOpen(nextOpen);
          if (trackEvents) {
            trackBlogEvent('Blog TOC Toggled', { open: nextOpen });
          }
        }}
      >
        <summary className="press -m-2 flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl p-2 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 dark:hover:bg-zinc-800/70 [&::-webkit-details-marker]:hidden">
          <h2 className="text-sm font-semibold">이 글에서 다루는 내용</h2>
          <span
            aria-hidden="true"
            className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400"
          >
            <span className="group-open:hidden">펼치기</span>
            <span className="hidden group-open:inline">접기</span>
            <span className="inline-block transition-transform group-open:rotate-180 motion-reduce:transition-none">
              ▾
            </span>
          </span>
        </summary>
        <ol className="mt-5 hidden flex-col gap-1 text-sm text-zinc-600 group-open:flex dark:text-zinc-400">
          {toc.map((item) => {
            const active = item.id === activeId;
            return (
              <li key={item.id} className={item.level === 3 ? 'pl-4' : ''}>
                <a
                  href={`#${item.id}`}
                  aria-current={active ? 'location' : undefined}
                  onClick={() => {
                    if (trackEvents) {
                      trackBlogEvent('Blog TOC Selected', {
                        level: item.level,
                      });
                    }
                  }}
                  className={`block rounded-lg px-2 py-1.5 transition-colors motion-reduce:transition-none ${
                    active
                      ? 'bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                      : 'hover:bg-zinc-50 hover:text-zinc-900 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100'
                  }`}
                >
                  {item.title}
                </a>
              </li>
            );
          })}
        </ol>
      </details>
    </nav>
  );
}
