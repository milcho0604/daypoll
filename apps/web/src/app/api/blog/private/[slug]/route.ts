import { type NextRequest, NextResponse } from 'next/server';
import { apiBaseUrl } from '@/lib/api';
import { getPost } from '@/lib/blog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Pragma: 'no-cache',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  Vary: 'x-admin-token',
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const token = request.headers.get('x-admin-token')?.trim();
  if (!token) {
    return NextResponse.json(
      { message: 'unauthorized' },
      { status: 401, headers: PRIVATE_HEADERS },
    );
  }

  let authResponse: Response;
  try {
    authResponse = await fetch(`${apiBaseUrl}/admin/stats`, {
      headers: { 'x-admin-token': token },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    return NextResponse.json(
      { message: 'auth unavailable' },
      { status: 503, headers: PRIVATE_HEADERS },
    );
  }
  if (authResponse.status === 401) {
    return NextResponse.json(
      { message: 'unauthorized' },
      { status: 401, headers: PRIVATE_HEADERS },
    );
  }
  if (!authResponse.ok) {
    return NextResponse.json(
      { message: 'auth unavailable' },
      { status: 503, headers: PRIVATE_HEADERS },
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

  return NextResponse.json(post, { headers: PRIVATE_HEADERS });
}
