// 백엔드 호출용 얇은 fetch 래퍼.
// 기획서 8장 엔드포인트 호출에 사용.

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  // server component 호출 시 캐시 무효화. 기본 no-store.
  cache?: RequestCache;
  // 디테일/결과 페이지에서 SSR 시 fetch 실패해도 페이지가 깨지지 않게 throw 옵션
  signal?: AbortSignal;
}

export class ApiError extends Error {
  constructor(public status: number, public payload: unknown) {
    super(`API ${status}`);
  }
}

export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers ?? {}),
    },
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
    cache: opts.cache ?? 'no-store',
    signal: opts.signal,
  });
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
