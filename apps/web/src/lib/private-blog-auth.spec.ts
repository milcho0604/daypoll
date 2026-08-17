import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  authenticatePrivateBlogToken,
  createPrivateBlogSession,
  PrivateBlogAttemptLimiter,
  verifyPrivateBlogSession,
} from './private-blog-auth';

const TOKEN = 'private-blog-token-for-tests';

describe('private blog auth', () => {
  beforeEach(() => {
    process.env.BLOG_PRIVATE_TOKEN = TOKEN;
  });

  afterEach(() => {
    delete process.env.BLOG_PRIVATE_TOKEN;
  });

  it('관리자 토큰과 무관한 전용 토큰만 인증한다', () => {
    process.env.ADMIN_TOKEN = TOKEN;
    process.env.BLOG_PRIVATE_TOKEN = 'different-private-token';
    expect(authenticatePrivateBlogToken(TOKEN)).toBe(false);
    expect(authenticatePrivateBlogToken('different-private-token')).toBe(true);
    delete process.env.ADMIN_TOKEN;
  });

  it('서명된 세션을 만들고 만료·변조·토큰 회전을 거부한다', () => {
    const now = Date.UTC(2026, 7, 17, 12, 0, 0);
    const session = createPrivateBlogSession(now);
    expect(verifyPrivateBlogSession(session, now + 1_000)).toBe(true);
    expect(verifyPrivateBlogSession(`${session}x`, now + 1_000)).toBe(false);
    expect(verifyPrivateBlogSession(session, now + 31 * 60 * 1_000)).toBe(false);
    process.env.BLOG_PRIVATE_TOKEN = 'rotated-private-blog-token';
    expect(verifyPrivateBlogSession(session, now + 1_000)).toBe(false);
  });

  it('너무 짧거나 과도하게 긴 토큰을 거부한다', () => {
    process.env.BLOG_PRIVATE_TOKEN = 'short';
    expect(authenticatePrivateBlogToken('short')).toBe(false);
    process.env.BLOG_PRIVATE_TOKEN = TOKEN;
    expect(authenticatePrivateBlogToken('x'.repeat(513))).toBe(false);
  });
});

describe('PrivateBlogAttemptLimiter', () => {
  it('실패만 세고 성공 시 초기화하며 창 만료 후 다시 허용한다', () => {
    const limiter = new PrivateBlogAttemptLimiter(2, 1_000);
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
