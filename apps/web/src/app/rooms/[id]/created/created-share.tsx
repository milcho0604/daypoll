'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function CreatedShare({ roomId }: { roomId: string }) {
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    // window/navigator(클라이언트 전용)를 마운트 시 읽어 동기화한다.
    const u = `${window.location.origin}/rooms/${roomId}`;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(u);
    setCanNativeShare(typeof navigator !== 'undefined' && 'share' in navigator);
  }, [roomId]);

  function flashNotice(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2000);
  }

  async function onCopy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // 클립보드 권한 없을 때 폴백
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    flashNotice('링크를 복사했어요. 단톡방에 붙여넣기 하세요!');
  }

  async function onShare() {
    if (!url || !canNativeShare) return;
    try {
      await navigator.share({ title: '언제모여', text: '같이 모일 날짜 정해요', url });
      flashNotice('공유했어요!');
    } catch {
      /* 사용자 취소 */
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="break-all font-mono text-sm text-zinc-700 dark:text-zinc-300">
          {url || '…'}
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCopy}
          className="h-12 flex-1 rounded-full border border-zinc-300 bg-white px-4 text-base font-medium transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          {copied ? '복사됨!' : '링크 복사'}
        </button>
        {canNativeShare && (
          <button
            type="button"
            onClick={onShare}
            className="h-12 flex-1 rounded-full bg-zinc-900 px-4 text-base font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            공유하기
          </button>
        )}
      </div>

      <Link
        href={`/rooms/${roomId}`}
        className="inline-flex h-12 items-center justify-center rounded-full bg-zinc-900 text-base font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        내가 먼저 투표하러 가기
      </Link>

      <p
        aria-live="polite"
        className={`min-h-5 text-center text-sm text-emerald-600 transition-opacity dark:text-emerald-400 ${
          notice ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {notice ?? ''}
      </p>
    </div>
  );
}
