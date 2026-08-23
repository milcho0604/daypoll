'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { probeHealth, SERVER_STATUS_EVENT } from '@/lib/api';

// 백엔드(Cloudflare Tunnel 뒤 맥미니)가 끊겼을 때 안내 팝업.
//
// 왜 필요하냐: 서버가 죽으면 화면이 조용히 실패해서 친구들은 "왜 안 되지?" 만 남는다.
// 특히 방 페이지는 로드 실패를 "링크가 만료됐나?" 로 오해하게 만든다.
//
// 오탐을 막는 두 장치:
//  1) 내 인터넷이 끊긴 것과 서버가 죽은 것을 구분한다. fetch 는 둘 다 똑같이
//     실패하는데, 지하철·엘리베이터에서 링크를 연 친구에게 "서버 점검 중" 은 거짓말이다.
//  2) api() 실패 1회로 바로 띄우지 않고 /health 로 한 번 더 확인한다.
//     일시적으로 튄 요청 때문에 팝업이 깜빡이지 않게.
const RECOVERY_POLL_MS = 10000;
const INITIAL_CHECK_DELAY_MS = 1200;

type Status = 'ok' | 'down' | 'offline';

export default function ServiceStatus() {
  const [status, setStatus] = useState<Status>('ok');
  const [dismissed, setDismissed] = useState(false);
  const [checking, setChecking] = useState(false);
  // 이벤트/타이머 콜백이 최신 상태를 읽되 effect 를 재구독시키지 않도록 ref 로 미러링
  const statusRef = useRef<Status>('ok');
  const inFlightRef = useRef(false);

  const apply = useCallback((next: Status) => {
    statusRef.current = next;
    setStatus(next);
    // 복구되면 다음 장애 때 다시 안내할 수 있게 닫힘 표시를 푼다
    if (next === 'ok') setDismissed(false);
  }, []);

  // 실제 상태 판정 — 오프라인이면 서버 탓을 하지 않는다.
  const evaluate = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      apply('offline');
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      apply((await probeHealth()) ? 'ok' : 'down');
    } finally {
      inFlightRef.current = false;
    }
  }, [apply]);

  // api() 가 알려주는 도달 여부 구독
  useEffect(() => {
    const onStatus = (e: Event) => {
      const detail = (e as CustomEvent<{ reachable: boolean }>).detail;
      if (typeof detail?.reachable !== 'boolean') return;
      if (detail.reachable) {
        apply('ok');
        return;
      }
      // 실패 신호는 힌트일 뿐 — 안내 중이 아닐 때만 한 번 더 확인하고 판정한다
      if (statusRef.current === 'ok') void evaluate();
    };
    window.addEventListener(SERVER_STATUS_EVENT, onStatus);
    return () => window.removeEventListener(SERVER_STATUS_EVENT, onStatus);
  }, [apply, evaluate]);

  // 브라우저가 알려주는 연결 상태 — 비행기모드/와이파이 끊김을 정확히 잡는다
  useEffect(() => {
    const onOffline = () => apply('offline');
    const onOnline = () => void evaluate();
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, [apply, evaluate]);

  // 첫 진입 확인 — 메인처럼 API 를 안 부르는 정적 페이지에서도 장애를 알 수 있게.
  // 렌더와 경쟁하지 않도록 살짝 미루고, 백그라운드 탭이면 건너뛴다.
  useEffect(() => {
    const id = setTimeout(() => {
      if (document.hidden) return;
      void evaluate();
    }, INITIAL_CHECK_DELAY_MS);
    return () => clearTimeout(id);
  }, [evaluate]);

  // 장애 중에만 복구 폴링 (평상시엔 아무 요청도 하지 않는다)
  useEffect(() => {
    if (status === 'ok') return;
    const id = setInterval(() => {
      if (document.hidden) return;
      void evaluate();
    }, RECOVERY_POLL_MS);
    return () => clearInterval(id);
  }, [status, evaluate]);

  async function retryNow() {
    setChecking(true);
    try {
      await evaluate();
    } finally {
      setChecking(false);
    }
  }

  if (status === 'ok' || dismissed) return null;

  const offline = status === 'offline';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={offline ? '인터넷 연결 안내' : '서비스 점검 안내'}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) setDismissed(true);
      }}
    >
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 dark:bg-zinc-900 sm:rounded-2xl">
        <h2 className="flex items-center gap-1.5 text-base font-semibold">
          <span aria-hidden>{offline ? '📡' : '🛠️'}</span>
          <span>
            {offline
              ? '인터넷 연결을 확인해주세요'
              : '잠깐만요, 서버 점검 중이에요'}
          </span>
        </h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {offline
            ? '지금 인터넷이 끊긴 것 같아요. 와이파이나 데이터를 확인해주세요.'
            : '지금 서버가 잠깐 쉬고 있어요. 조금 뒤에 다시 시도해주세요.'}
        </p>
        <p className="mt-3 rounded-xl bg-zinc-100 px-3 py-2 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          걱정 마세요! 만들어둔 방이랑 투표한 내용은 그대로 저장돼 있어요.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="press h-11 flex-1 rounded-full border border-zinc-300 text-sm dark:border-zinc-700"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={() => void retryNow()}
            disabled={checking}
            className="press h-11 flex-1 rounded-full bg-zinc-900 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900"
          >
            {checking ? '확인 중…' : '다시 시도'}
          </button>
        </div>
      </div>
    </div>
  );
}
