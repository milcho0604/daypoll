import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './api';
import { adminGetStats } from './admin';

// adminFetch 도 api() 와 같은 규칙 — 실패 응답 본문은 딱 한 번만 읽는다.
// 터널이 끊기면 Cloudflare 가 502/530 에 HTML 을 주는데, res.json() 실패 뒤
// res.text() 를 다시 부르면 "Body is unusable" TypeError 가 ApiError 를 삼켜
// 어드민 화면의 에러 안내가 깨진다. (api.ts 는 #81 에서, 여기는 이 테스트로 고정)
function mockFetch(status: number, body: string, contentType = 'text/plain') {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(body, { status, headers: { 'content-type': contentType } }),
    ),
  );
}

beforeEach(() => {
  // node 환경엔 window 가 없어 getAdminToken() 이 null → 401 로 끝나버린다.
  // 토큰이 있는 상태를 흉내 낸다.
  const store = new Map<string, string>([['whenever_admin_token', 'test-token']]);
  vi.stubGlobal('window', {
    sessionStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('adminFetch 실패 응답', () => {
  it('JSON 이 아닌 본문(터널 502 HTML)에도 ApiError 를 던진다', async () => {
    mockFetch(502, '<html>Bad gateway</html>', 'text/html');
    const err = await adminGetStats().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).not.toBeInstanceOf(TypeError);
    expect((err as ApiError).status).toBe(502);
    expect((err as ApiError).payload).toBe('<html>Bad gateway</html>');
  });

  it('401 의 JSON 본문은 객체로 넘긴다 — 토큰 만료 안내가 여기 걸려 있다', async () => {
    mockFetch(401, '{"message":"unauthorized"}', 'application/json');
    const err = await adminGetStats().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(401);
    expect((err as ApiError).payload).toEqual({ message: 'unauthorized' });
  });

  it('본문이 비어 있어도 터지지 않는다', async () => {
    mockFetch(503, '');
    const err = await adminGetStats().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(503);
    expect((err as ApiError).payload).toBeNull();
  });
});
