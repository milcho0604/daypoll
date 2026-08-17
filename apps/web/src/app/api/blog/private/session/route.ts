import { type NextRequest, NextResponse } from 'next/server';
import {
  auditPrivateBlog,
  authenticatePrivateBlogToken,
  createPrivateBlogSession,
  PRIVATE_BLOG_COOKIE,
  PRIVATE_BLOG_SESSION_SECONDS,
  PrivateBlogAttemptLimiter,
  privateBlogClientKey,
  privateBlogEnabled,
} from '@/lib/private-blog-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const limiter = new PrivateBlogAttemptLimiter();
const MAX_BODY_BYTES = 2_048;
const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Pragma: 'no-cache',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  Vary: 'Cookie',
};

function error(status: number, message: string, retryAfter?: number) {
  return NextResponse.json(
    { message },
    {
      status,
      headers: {
        ...PRIVATE_HEADERS,
        ...(retryAfter ? { 'Retry-After': String(retryAfter) } : {}),
      },
    },
  );
}

class PayloadTooLargeError extends Error {}

async function readToken(request: NextRequest): Promise<unknown> {
  if (!request.body) throw new Error('missing body');
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let raw = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      try {
        await reader.cancel();
      } catch {
        // 이미 닫힌 스트림이어도 크기 초과 응답은 동일하다.
      }
      throw new PayloadTooLargeError();
    }
    raw += decoder.decode(value, { stream: true });
  }
  raw += decoder.decode();
  const body = JSON.parse(raw) as unknown;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('invalid body');
  }
  return (body as { token?: unknown }).token;
}

export async function POST(request: NextRequest) {
  if (!privateBlogEnabled()) return error(503, 'private blog disabled');
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BODY_BYTES) return error(413, 'payload too large');

  const clientKey = privateBlogClientKey(request.headers);
  if (!limiter.canAttempt(clientKey)) {
    return error(429, 'too many attempts', limiter.retryAfter(clientKey));
  }

  let token: unknown;
  try {
    token = await readToken(request);
  } catch (caught) {
    if (caught instanceof PayloadTooLargeError) {
      return error(413, 'payload too large');
    }
    return error(400, 'invalid request');
  }

  if (!authenticatePrivateBlogToken(token)) {
    limiter.recordFailure(clientKey);
    auditPrivateBlog('auth_failed');
    return error(401, 'unauthorized');
  }

  limiter.clear(clientKey);
  const response = NextResponse.json(
    { ok: true, expiresIn: PRIVATE_BLOG_SESSION_SECONDS },
    { headers: PRIVATE_HEADERS },
  );
  response.cookies.set({
    name: PRIVATE_BLOG_COOKIE,
    value: createPrivateBlogSession(),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: PRIVATE_BLOG_SESSION_SECONDS,
  });
  auditPrivateBlog('auth_succeeded');
  return response;
}

export async function DELETE() {
  const response = NextResponse.json(
    { ok: true },
    { headers: PRIVATE_HEADERS },
  );
  response.cookies.set({
    name: PRIVATE_BLOG_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
  auditPrivateBlog('locked');
  return response;
}
