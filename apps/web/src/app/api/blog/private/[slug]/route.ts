import { type NextRequest, NextResponse } from 'next/server';
import { getPost } from '@/lib/blog';
import {
  ADMIN_TOKEN_HEADER,
  AdminBlogAttemptLimiter,
  adminBlogClientKey,
  auditAdminBlog,
  verifyAdminBlogToken,
} from '@/lib/admin-blog-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Pragma: 'no-cache',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  Vary: ADMIN_TOKEN_HEADER,
};

const limiter = new AdminBlogAttemptLimiter();

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const clientKey = adminBlogClientKey(request.headers);
  if (!limiter.canAttempt(clientKey)) {
    return error(429, 'too many attempts', limiter.retryAfter(clientKey));
  }

  const auth = await verifyAdminBlogToken(
    request.headers.get(ADMIN_TOKEN_HEADER),
  );
  if (auth === 'unauthorized') {
    limiter.recordFailure(clientKey);
    auditAdminBlog('auth_failed');
    return error(401, 'unauthorized');
  }
  if (auth === 'rate_limited') return error(429, 'too many attempts');
  if (auth === 'disabled') return error(503, 'admin disabled');
  if (auth === 'unavailable') return error(502, 'admin unavailable');
  limiter.clear(clientKey);

  const { slug } = await params;
  const post = getPost(slug);
  if (
    !post ||
    post.meta.visibility !== 'private' ||
    (post.meta.draft && process.env.NODE_ENV === 'production')
  ) {
    return NextResponse.json(
      { message: 'not found' },
      { status: 404, headers: PRIVATE_HEADERS },
    );
  }

  auditAdminBlog('post_read', slug);
  return NextResponse.json(post, { headers: PRIVATE_HEADERS });
}
