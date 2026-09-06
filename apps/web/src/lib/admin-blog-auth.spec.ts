import { describe, expect, it, vi } from 'vitest';
import {
  ADMIN_TOKEN_HEADER,
  AdminBlogAttemptLimiter,
  verifyAdminBlogToken,
} from './admin-blog-auth';

describe('admin blog auth', () => {
  it('기존 어드민 인증 엔드포인트와 토큰 헤더를 재사용한다', async () => {
    const fetcher = vi.fn(async () => Response.json({ ok: true }));
    await expect(
      verifyAdminBlogToken(' existing-admin-token ', fetcher),
    ).resolves.toBe('authorized');
    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:3001/admin/auth',
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
        headers: { [ADMIN_TOKEN_HEADER]: 'existing-admin-token' },
      }),
    );
  });

  it('빈 값과 과도하게 긴 값은 API 호출 없이 거부한다', async () => {
    const fetcher = vi.fn();
    await expect(verifyAdminBlogToken('', fetcher)).resolves.toBe(
      'unauthorized',
    );
    await expect(
      verifyAdminBlogToken('x'.repeat(513), fetcher),
    ).resolves.toBe('unauthorized');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    [401, 'unauthorized'],
    [403, 'unauthorized'],
    [429, 'rate_limited'],
    [503, 'disabled'],
    [500, 'unavailable'],
  ] as const)('API %i 응답을 %s로 정규화한다', async (status, result) => {
    const fetcher = vi.fn(async () => new Response(null, { status }));
    await expect(verifyAdminBlogToken('admin-token', fetcher)).resolves.toBe(
      result,
    );
  });

  it('네트워크 실패 시 본문을 닫아 둔다', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('offline');
    });
    await expect(verifyAdminBlogToken('admin-token', fetcher)).resolves.toBe(
      'unavailable',
    );
  });
});

describe('AdminBlogAttemptLimiter', () => {
  it('실패만 세고 성공 시 초기화하며 창 만료 후 다시 허용한다', () => {
    const limiter = new AdminBlogAttemptLimiter(2, 1_000);
    expect(limiter.canAttempt('client', 0)).toBe(true);
    limiter.recordFailure('client', 0);
    expect(limiter.canAttempt('client', 100)).toBe(true);
    limiter.recordFailure('client', 100);
    expect(limiter.canAttempt('client', 200)).toBe(false);
    expect(limiter.retryAfter('client', 200)).toBe(1);
    limiter.clear('client');
    expect(limiter.canAttempt('client', 200)).toBe(true);
    limiter.recordFailure('client', 200);
    expect(limiter.canAttempt('client', 1_201)).toBe(true);
  });
});
