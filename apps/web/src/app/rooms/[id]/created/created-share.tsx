'use client';

import Link from 'next/link';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

export default function CreatedShare({ roomId }: { roomId: string }) {
  const [url, setUrl] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const u = `${window.location.origin}/rooms/${roomId}`;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(u);
    setCanNativeShare(typeof navigator !== 'undefined' && 'share' in navigator);
    QRCode.toDataURL(u, {
      margin: 1,
      width: 240,
      color: { dark: '#18181b', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then((d) => setQrDataUrl(d))
      .catch(() => setQrDataUrl(''));
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
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    flashNotice('링크 복사 완료 — 단톡방에 붙여넣으세요!');
  }

  async function onCopyMessage() {
    const msg = `우리 언제 모일까? 🗓️\n가입 X · 가능한 날만 체크하면 끝 (1분 컷)\n👉 ${url}`;
    try {
      await navigator.clipboard.writeText(msg);
      flashNotice('카톡용 문구 복사 완료!');
    } catch {
      /* ignore */
    }
  }

  async function onShare() {
    if (!url || !canNativeShare) return;
    try {
      await navigator.share({
        title: '언제모여',
        text: '우리 언제 모일까? 가능한 날만 체크하면 끝 🗓️',
        url,
      });
      flashNotice('공유했어요!');
    } catch {
      /* 사용자 취소 */
    }
  }

  return (
    <div className="flex flex-col gap-5 fade-up">
      {qrDataUrl && (
        <div className="flex flex-col items-center gap-2">
          <div className="pop-in rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt="방 QR 코드"
              className="h-40 w-40 sm:h-48 sm:w-48"
            />
          </div>
          <p className="text-xs text-zinc-500">옆자리 친구한테 비추세요</p>
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="break-all font-mono text-xs text-zinc-700 dark:text-zinc-300">
          {url || '…'}
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCopy}
          className="press h-12 flex-1 rounded-full border border-zinc-300 bg-white px-4 text-sm font-medium transition-colors hover:border-zinc-900 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-100 dark:hover:bg-zinc-800"
        >
          {copied ? '✓ 복사됨' : '🔗 링크만 복사'}
        </button>
        <button
          type="button"
          onClick={onCopyMessage}
          className="press h-12 flex-1 rounded-full border border-zinc-300 bg-white px-4 text-sm font-medium transition-colors hover:border-zinc-900 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-100 dark:hover:bg-zinc-800"
        >
          💬 카톡용 문구
        </button>
      </div>

      {canNativeShare && (
        <button
          type="button"
          onClick={onShare}
          className="press h-12 w-full rounded-full bg-zinc-900 text-base font-medium text-white shadow-md shadow-zinc-900/20 transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          📤 공유하기
        </button>
      )}

      <Link
        href={`/rooms/${roomId}`}
        className="press inline-flex h-12 items-center justify-center gap-2 rounded-full border-2 border-zinc-900 bg-white text-base font-semibold text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-white dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-900"
      >
        나도 투표하러 가기 →
      </Link>

      <p
        aria-live="polite"
        className={`min-h-5 text-center text-sm font-medium text-emerald-600 transition-opacity dark:text-emerald-400 ${
          notice ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {notice ?? ''}
      </p>
    </div>
  );
}
