'use client';

import { useEffect } from 'react';

// 모달 공통 — ESC 키로 닫기 (바깥 탭 닫기는 각 오버레이의 onClick 에서).
export function useEscClose(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
}
