import Link from 'next/link';
import type { RoomDetail } from '@whenever/shared';
import { ApiError } from '@/lib/api';
import { getRoom } from '@/lib/rooms';
import RoomView from './room-view';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // 개별 방 URL 은 개인 모임용 — 검색 인덱싱 금지 (OG 공유 카드는 정상 동작).
  const robots = { index: false, follow: false } as const;
  try {
    const room = await getRoom(id);
    const description = `${room.title} — 참여자 ${room.participantCount}명. 가능한 날짜에 투표해주세요.`;
    return {
      title: `${room.title} · 언제모여`,
      description,
      robots,
      openGraph: {
        title: `${room.title} · 언제모여`,
        description,
        type: 'website',
        url: `/rooms/${id}`,
      },
      twitter: {
        card: 'summary_large_image',
        title: `${room.title} · 언제모여`,
        description,
      },
    };
  } catch {
    return { title: '방 · 언제모여', robots };
  }
}

export default async function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // 데이터 페치만 try/catch 안에서 수행하고, 렌더(JSX 반환)는 밖에서 한다.
  // (try/catch 안에서 JSX를 반환하면 렌더 단계 에러는 못 잡는다 — react-hooks/error-boundaries)
  let room: RoomDetail | null = null;
  let notFound = false;
  try {
    room = await getRoom(id);
  } catch (err) {
    notFound = err instanceof ApiError && err.status === 404;
  }

  if (!room) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-12 text-center">
        <h1 className="text-xl font-semibold">
          {notFound ? '방을 찾을 수 없어요' : '방을 불러오지 못했어요'}
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          링크가 만료됐거나 잘못된 주소일 수 있습니다.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-11 items-center rounded-full bg-zinc-900 px-5 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
        >
          홈으로
        </Link>
      </main>
    );
  }

  return <RoomView roomId={id} initial={room} />;
}
