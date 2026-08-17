import {
  createHash,
  createHmac,
  timingSafeEqual,
} from 'node:crypto';

export const PRIVATE_BLOG_COOKIE = 'whenever_blog_session';
export const PRIVATE_BLOG_SESSION_SECONDS = 30 * 60;

const SESSION_VERSION = 'v1';
const MIN_TOKEN_LENGTH = 16;
const MAX_TOKEN_LENGTH = 512;

function configuredToken(): string | null {
  const token = process.env.BLOG_PRIVATE_TOKEN?.trim();
  return token && token.length >= MIN_TOKEN_LENGTH ? token : null;
}

function safeEquals(left: string, right: string): boolean {
  const leftDigest = createHash('sha256').update(left).digest();
  const rightDigest = createHash('sha256').update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

function signature(payload: string, token: string): string {
  return createHmac('sha256', token).update(payload).digest('base64url');
}

export function privateBlogEnabled(): boolean {
  return configuredToken() !== null;
}

export function authenticatePrivateBlogToken(candidate: unknown): boolean {
  const required = configuredToken();
  if (
    !required ||
    typeof candidate !== 'string' ||
    candidate.length > MAX_TOKEN_LENGTH
  ) {
    return false;
  }
  return safeEquals(candidate.trim(), required);
}

export function createPrivateBlogSession(now = Date.now()): string {
  const token = configuredToken();
  if (!token) throw new Error('private blog disabled');
  const expiresAt = Math.floor(now / 1000) + PRIVATE_BLOG_SESSION_SECONDS;
  const payload = `${SESSION_VERSION}.${expiresAt}`;
  return `${payload}.${signature(payload, token)}`;
}

export function verifyPrivateBlogSession(
  session: string | null | undefined,
  now = Date.now(),
): boolean {
  const token = configuredToken();
  if (!token || !session || session.length > 256) return false;
  const parts = session.split('.');
  if (parts.length !== 3 || parts[0] !== SESSION_VERSION) return false;
  const expiresAt = Number(parts[1]);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(now / 1000)) {
    return false;
  }
  const payload = `${parts[0]}.${parts[1]}`;
  return safeEquals(parts[2], signature(payload, token));
}

type AttemptBucket = { failures: number; resetAt: number };

export class PrivateBlogAttemptLimiter {
  private readonly buckets = new Map<string, AttemptBucket>();
  private lastSweep = 0;

  constructor(
    private readonly limit = 5,
    private readonly windowMs = 10 * 60 * 1000,
  ) {}

  canAttempt(key: string, now = Date.now()): boolean {
    this.sweep(now);
    const bucket = this.buckets.get(key);
    return !bucket || bucket.resetAt <= now || bucket.failures < this.limit;
  }

  recordFailure(key: string, now = Date.now()): number {
    this.sweep(now);
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { failures: 0, resetAt: now + this.windowMs };
      this.buckets.set(key, bucket);
    }
    bucket.failures += 1;
    return Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  }

  clear(key: string): void {
    this.buckets.delete(key);
  }

  retryAfter(key: string, now = Date.now()): number {
    const bucket = this.buckets.get(key);
    return bucket
      ? Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
      : 1;
  }

  private sweep(now: number): void {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}

export function privateBlogClientKey(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const real = headers.get('x-real-ip')?.trim();
  return (forwarded || real || 'unknown').slice(0, 128);
}

export function auditPrivateBlog(
  event: 'auth_failed' | 'auth_succeeded' | 'locked' | 'post_read',
  slug?: string,
): void {
  const slugHash = slug
    ? createHash('sha256').update(slug).digest('hex').slice(0, 12)
    : undefined;
  console.info(
    '[blog-audit]',
    JSON.stringify({ event, ...(slugHash ? { slugHash } : {}) }),
  );
}
