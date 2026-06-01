import Link from 'next/link';
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
  try {
    const room = await getRoom(id);
    return { title: `${room.title} · 언제모여` };
  } catch {
    return { title: '방 · 언제모여' };
  }
}

export default async function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  try {
    const room = await getRoom(id);
    return <RoomView roomId={id} initial={room} />;
  } catch (err) {
    const notFound = err instanceof ApiError && err.status === 404;
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
}
