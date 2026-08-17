import { type NextRequest, NextResponse } from 'next/server';
import { getPost } from '@/lib/blog';
import {
  auditPrivateBlog,
  PRIVATE_BLOG_COOKIE,
  verifyPrivateBlogSession,
} from '@/lib/private-blog-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Pragma: 'no-cache',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  Vary: 'Cookie',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = request.cookies.get(PRIVATE_BLOG_COOKIE)?.value;
  if (!verifyPrivateBlogSession(session)) {
    return NextResponse.json(
      { message: 'unauthorized' },
      { status: 401, headers: PRIVATE_HEADERS },
    );
  }

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

  auditPrivateBlog('post_read', slug);
  return NextResponse.json(post, { headers: PRIVATE_HEADERS });
}
