import { HttpException } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';

describe('RateLimitService', () => {
  const prev = process.env.RATE_LIMIT_DISABLED;
  beforeEach(() => {
    delete process.env.RATE_LIMIT_DISABLED;
  });
  afterAll(() => {
    if (prev === undefined) delete process.env.RATE_LIMIT_DISABLED;
    else process.env.RATE_LIMIT_DISABLED = prev;
  });

  it('limit 횟수까지는 통과하고 초과하면 429를 던진다', () => {
    const rl = new RateLimitService();
    for (let i = 0; i < 3; i++) {
      expect(() => rl.check('k', 3, 60)).not.toThrow();
    }
    let status = 0;
    try {
      rl.check('k', 3, 60);
    } catch (e) {
      status = (e as HttpException).getStatus();
    }
    expect(status).toBe(429);
  });

  it('key가 다르면 독립적으로 카운트된다', () => {
    const rl = new RateLimitService();
    rl.check('a', 1, 60);
    expect(() => rl.check('b', 1, 60)).not.toThrow();
    expect(() => rl.check('a', 1, 60)).toThrow();
  });

  it('RATE_LIMIT_DISABLED 설정 시 무력화된다', () => {
    process.env.RATE_LIMIT_DISABLED = '1';
    const rl = new RateLimitService();
    for (let i = 0; i < 100; i++) {
      expect(() => rl.check('k', 1, 60)).not.toThrow();
    }
  });
});
