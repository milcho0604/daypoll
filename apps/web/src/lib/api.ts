// 백엔드 호출용 얇은 fetch 래퍼.
// 기획서 8장 엔드포인트 호출에 사용.

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  // server component 호출 시 캐시 무효화. 기본 no-store.
  cache?: RequestCache;
  // ISR — 지정 시 no-store 대신 Next 데이터 캐시에 n초 보관 (방 껍데기 같은 준불변 데이터용)
  revalidate?: number;
  // 디테일/결과 페이지에서 SSR 시 fetch 실패해도 페이지가 깨지지 않게 throw 옵션
  signal?: AbortSignal;
}

export class ApiError extends Error {
  constructor(public status: number, public payload: unknown) {
    super(`API ${status}`);
  }
}

// 서버 도달 불가 판정에 쓰는 상태 코드 — 게이트웨이/터널 계열.
// (백엔드는 Cloudflare Tunnel 뒤에 있어 터널이 끊기면 502/530 이 온다)
// 500 은 특정 엔드포인트 버그일 수 있어 "점검 중"으로 보지 않는다.
const UNREACHABLE_STATUSES = new Set([502, 503, 504, 520, 521, 522, 523, 524, 530]);

export const SERVER_STATUS_EVENT = 'moilga:server-status';

// 서버 도달 여부를 앱 전역에 알린다 (ServiceStatus 팝업이 구독).
// 라이브러리 계층이라 UI 를 직접 모르고 이벤트만 던진다.
function notifyServerReachable(reachable: boolean) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(SERVER_STATUS_EVENT, { detail: { reachable } }),
  );
}

// 상태 확인 전용 프로브 — 이벤트를 쏘지 않는다(구독자가 이걸 호출하므로 재귀 방지).
// 한 번의 일시적 실패로 팝업이 깜빡이지 않게, api() 실패를 이걸로 "확인 사살" 한다.
export async function probeHealth(timeoutMs = 5000): Promise<boolean> {
  if (typeof window !== 'undefined' && navigator.onLine === false) return false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE_URL}/health`, {
      cache: 'no-store',
      signal: ctrl.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// fetch 캐시 옵션은 서버/브라우저가 다르다.
// - 서버(Next SSR/ISR): `next.revalidate` 또는 `cache: 'no-store'` 로 Next 데이터 캐시를 제어.
// - 브라우저: `cache: 'no-store' | 'no-cache'` 를 주면 Chromium 이 HTTP 캐시뿐 아니라
//   **CORS preflight 캐시까지 건너뛰어** 호출마다 OPTIONS 왕복이 생긴다 (CDP 실측).
//   응답 캐시 금지는 API 가 `Cache-Control: no-store` 로 보장하므로 여기선 기본 모드.
//   호출자가 명시적으로 cache 를 준 경우(헬스 프로브)만 그대로 넘긴다.
function cacheOptions(opts: ApiOptions): RequestInit & { next?: { revalidate: number } } {
  if (typeof window === 'undefined') {
    return opts.revalidate != null
      ? { next: { revalidate: opts.revalidate } }
      : { cache: opts.cache ?? 'no-store' };
  }
  return opts.cache ? { cache: opts.cache } : {};
}

export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  let res: Response;
  try {
    // Content-Type 은 본문이 있을 때만. GET 에까지 application/json 을 붙이면
    // "simple request" 조건이 깨져 브라우저가 매 GET 앞에 OPTIONS(preflight)를
    // 보낸다 — 결과 폴링·날씨·헬스 전부 왕복 2배였다 (CDP 로 실측).
    // x-client-token 이 붙는 요청은 여전히 preflight 되지만, API 쪽
    // Access-Control-Max-Age 로 10분에 한 번으로 줄인다.
    res = await fetch(`${BASE_URL}${path}`, {
      method: opts.method ?? 'GET',
      headers: {
        ...(opts.body != null ? { 'Content-Type': 'application/json' } : {}),
        ...(opts.headers ?? {}),
      },
      body: opts.body != null ? JSON.stringify(opts.body) : undefined,
      ...cacheOptions(opts),
      signal: opts.signal,
    });
  } catch (err) {
    // abort 는 사용자가 화면을 떠났거나 컴포넌트가 언마운트된 것 — 장애 아님.
    if ((err as Error)?.name !== 'AbortError') notifyServerReachable(false);
    throw err;
  }
  // HTTP 응답을 받았다는 것 자체가 도달 성공. 단 게이트웨이 계열은 백엔드 다운.
  notifyServerReachable(!UNREACHABLE_STATUSES.has(res.status));
  if (!res.ok) {
    let payload: unknown = null;
    try {
      payload = await res.json();
    } catch {
      payload = await res.text();
    }
    throw new ApiError(res.status, payload);
  }
  return (await res.json()) as T;
}

export const apiBaseUrl = BASE_URL;
