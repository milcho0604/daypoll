import { createHash } from 'node:crypto';

export const ADMIN_TOKEN_HEADER = 'x-admin-token';

const MAX_TOKEN_LENGTH = 512;
const AUTH_TIMEOUT_MS = 5_000;

export type AdminBlogAuthResult =
  | 'authorized'
  | 'unauthorized'
  | 'disabled'
  | 'rate_limited'
  | 'unavailable';

type Fetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

function adminAuthUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';
  return `${base.replace(/\/+$/, '')}/admin/auth`;
}

export async function verifyAdminBlogToken(
  candidate: unknown,
  fetcher: Fetcher = fetch,
): Promise<AdminBlogAuthResult> {
  if (
    typeof candidate !== 'string' ||
    candidate.trim().length === 0 ||
    candidate.length > MAX_TOKEN_LENGTH
  ) {
    return 'unauthorized';
  }

  try {
    const response = await fetcher(adminAuthUrl(), {
      method: 'GET',
      headers: { [ADMIN_TOKEN_HEADER]: candidate.trim() },
      cache: 'no-store',
      signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
    });
    if (response.ok) return 'authorized';
    if (response.status === 401 || response.status === 403) {
      return 'unauthorized';
    }
    if (response.status === 429) return 'rate_limited';
    if (response.status === 503) return 'disabled';
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}

type AttemptBucket = { failures: number; resetAt: number };

export class AdminBlogAttemptLimiter {
  private readonly buckets = new Map<string, AttemptBucket>();
  private lastSweep = 0;

  constructor(
    private readonly limit = 5,
    private readonly windowMs = 10 * 60 * 1_000,
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
    return Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000));
  }

  clear(key: string): void {
    this.buckets.delete(key);
  }

  retryAfter(key: string, now = Date.now()): number {
    const bucket = this.buckets.get(key);
    return bucket
      ? Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000))
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

export function adminBlogClientKey(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const real = headers.get('x-real-ip')?.trim();
  return (forwarded || real || 'unknown').slice(0, 128);
}

export function auditAdminBlog(
  event: 'auth_failed' | 'post_read',
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
