import { describe, expect, it, vi, afterEach } from 'vitest';
import { api, ApiError } from './api';

// 실패 응답의 본문은 딱 한 번만 읽어야 한다.
// res.json() 이 실패한 뒤 res.text() 를 부르면 스트림이 이미 소비돼
// "Body is unusable" TypeError 가 ApiError 대신 새어나가고, 호출부의
// `err instanceof ApiError` 판정이 전부 무너진다.
// 백엔드가 Cloudflare Tunnel 뒤라 터널이 끊기면 502/530 에 HTML 이 온다.
function mockFetch(status: number, body: string, contentType = 'text/plain') {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(body, { status, headers: { 'content-type': contentType } }),
    ),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api() 실패 응답', () => {
  it('JSON 이 아닌 본문(터널 502 HTML)에도 ApiError 를 던진다', async () => {
    mockFetch(502, '<html>Bad gateway</html>', 'text/html');
    const err = await api('/rooms/x').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).not.toBeInstanceOf(TypeError);
    expect((err as ApiError).status).toBe(502);
    expect((err as ApiError).payload).toBe('<html>Bad gateway</html>');
  });

  it('404 의 JSON 본문은 객체로 넘긴다 — 방 페이지의 404 판정이 여기 걸려 있다', async () => {
    mockFetch(404, '{"message":"not found"}', 'application/json');
    const err = await api('/rooms/x').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(404);
    expect((err as ApiError).payload).toEqual({ message: 'not found' });
  });

  it('본문이 비어 있어도 터지지 않는다', async () => {
    mockFetch(503, '');
    const err = await api('/rooms/x').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(503);
    expect((err as ApiError).payload).toBeNull();
  });
});
