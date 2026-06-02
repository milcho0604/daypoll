import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

interface Bucket {
  count: number;
  resetAt: number; // epoch ms
}

// 단일 인스턴스(맥미니) 인프라에 맞춘 인메모리 고정 윈도우 레이트리밋.
// 외부 의존성 없이 남용/브루트포스만 막는 게 목적이다.
// RATE_LIMIT_DISABLED 가 설정되면 무력화(테스트 등).
@Injectable()
export class RateLimitService {
  private readonly buckets = new Map<string, Bucket>();
  private lastSweep = Date.now();

  // key를 windowSec 동안 limit회까지 허용. 초과 시 429 throw.
  check(key: string, limit: number, windowSec: number): void {
    if (process.env.RATE_LIMIT_DISABLED) return;
    const now = Date.now();
    this.sweep(now);

    let b = this.buckets.get(key);
    if (!b || b.resetAt <= now) {
      b = { count: 0, resetAt: now + windowSec * 1000 };
      this.buckets.set(key, b);
    }
    b.count += 1;
    if (b.count > limit) {
      const retryAfter = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: 'rate limit exceeded',
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  // 만료된 버킷을 가끔 청소해 메모리 누수를 막는다.
  private sweep(now: number): void {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    for (const [k, b] of this.buckets) {
      if (b.resetAt <= now) this.buckets.delete(k);
    }
  }
}
