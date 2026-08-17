'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, SERVER_STATUS_EVENT } from '@/lib/api';

// 백엔드(Cloudflare Tunnel 뒤 맥미니)가 잠깐 끊겼을 때 "점검 중" 안내 팝업.
//
// 왜 필요하냐: 서버가 죽으면 화면이 조용히 실패해서 친구들은 "왜 안 되지?" 만 남는다.
// 특히 방 페이지는 로드 실패를 "링크가 만료됐나?" 로 오해하게 만든다.
//
// 동작:
//   - api() 가 도달 실패를 감지하면 이벤트 → 팝업
//   - 뜬 동안 주기적으로 /health 확인 → 복구되면 자동으로 닫힘
//   - 닫기 누르면 이번 장애 동안은 안 뜸 (복구 후 새 장애면 다시 뜸)
const RECOVERY_POLL_MS = 10000;
const INITIAL_CHECK_DELAY_MS = 1200;

export default function ServiceStatus() {
  const [down, setDown] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  // 이벤트 핸들러에서 최신 상태를 읽되, effect 를 재구독시키지 않기 위해 ref 사용
  const downRef = useRef(false);

  const setReachable = useCallback((reachable: boolean) => {
    downRef.current = !reachable;
    setDown(!reachable);
    // 복구되면 다음 장애 때 다시 안내할 수 있게 닫힘 표시를 푼다
    if (reachable) setDismissed(false);
  }, []);

  // api() 가 알려주는 도달 여부 구독
  useEffect(() => {
    const onStatus = (e: Event) => {
      const detail = (e as CustomEvent<{ reachable: boolean }>).detail;
      if (typeof detail?.reachable === 'boolean') setReachable(detail.reachable);
    };
    window.addEventListener(SERVER_STATUS_EVENT, onStatus);
    return () => window.removeEventListener(SERVER_STATUS_EVENT, onStatus);
  }, [setReachable]);

  // 첫 진입 확인 — 메인처럼 API 를 안 부르는 정적 페이지에서도 장애를 알 수 있게.
  // 렌더와 경쟁하지 않도록 살짝 미루고, 백그라운드 탭이면 건너뛴다.
  useEffect(() => {
    const id = setTimeout(() => {
      if (document.hidden) return;
      // api() 안에서 성공/실패 모두 이벤트를 쏘므로 결과 처리는 구독자가 한다
      void api('/health').catch(() => {});
    }, INITIAL_CHECK_DELAY_MS);
    return () => clearTimeout(id);
  }, []);

  // 장애 중에만 복구 폴링 (평상시엔 아무 요청도 하지 않는다)
  useEffect(() => {
    if (!down) return;
    const id = setInterval(() => {
      if (document.hidden) return;
      void api('/health').catch(() => {});
    }, RECOVERY_POLL_MS);
    return () => clearInterval(id);
  }, [down]);

  async function retryNow() {
    setRetrying(true);
    try {
      await api('/health');
    } catch {
      /* 실패해도 api() 가 상태 이벤트를 쏜다 */
    } finally {
      setRetrying(false);
    }
  }

  if (!down || dismissed) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="서비스 점검 안내"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) setDismissed(true);
      }}
    >
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 dark:bg-zinc-900 sm:rounded-2xl">
        <h2 className="flex items-center gap-1.5 text-base font-semibold">
          <span aria-hidden>🛠️</span>
          <span>잠깐만요, 서버 점검 중이에요</span>
        </h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          지금 서버가 잠깐 쉬고 있어요. 조금 뒤에 다시 시도해주세요.
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
            disabled={retrying}
            className="press h-11 flex-1 rounded-full bg-zinc-900 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900"
          >
            {retrying ? '확인 중…' : '다시 시도'}
          </button>
        </div>
      </div>
    </div>
  );
}
