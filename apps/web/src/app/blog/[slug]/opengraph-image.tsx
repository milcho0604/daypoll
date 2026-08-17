import { ImageResponse } from 'next/og';
import { getPost } from '@/lib/blog';

export const alt = '모일까 블로그 글 대표 이미지';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const runtime = 'nodejs';

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPost(slug);
  const isPublic = post?.meta.visibility === 'public' && !post.meta.draft;
  const title = isPublic ? post.meta.title : '비공개 글';
  const category = isPublic ? post.meta.category : '모일까 블로그';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#18181b',
          color: '#fafafa',
          padding: '72px 80px',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 30,
            color: '#d4d4d8',
          }}
        >
          {category}
        </div>
        <div
          style={{
            display: 'flex',
            maxWidth: 1040,
            fontSize: title.length > 42 ? 54 : 64,
            fontWeight: 700,
            lineHeight: 1.18,
            letterSpacing: '-0.03em',
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 28,
            color: '#a1a1aa',
          }}
        >
          <span>모일까</span>
          <span>moilga.com/blog</span>
        </div>
      </div>
    ),
    size,
  );
}
