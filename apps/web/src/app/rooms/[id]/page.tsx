import Link from 'next/link';
import type { RoomDetail } from '@whenever/shared';
import { ApiError } from '@/lib/api';
import { getRoom } from '@/lib/rooms';
import { formatDateKR } from '@/lib/format';
import ForgetRoomOnMount from '@/components/forget-room-on-mount';
import RoomView from './room-view';

// 라우트는 동적 렌더, **데이터만 30초 캐시** (getRoom 의 revalidate 인자).
//
// 예전엔 페이지 자체를 on-demand ISR 로 캐시했는데, 백엔드가 잠깐 끊긴 사이
// 만들어진 "점검 중" 화면이 정상 200 으로 캐시에 박혀 서버가 복구된 뒤에도
// 계속 나갔다 (#80 — 실측: 복구 후에도 30초 넘게, 방문자가 드문 방이면 다음
// 방문자가 올 때까지 무한정). 실패 화면을 캐시하지 않으려면 라우트가 동적이어야 한다.
//
// 성능 의도(첫 페인트의 백엔드 왕복 제거)는 fetch 데이터 캐시가 그대로 지킨다 —
// 실측: 웹 요청 10회 → API 호출 1회, 30초 만료 후 다시 1회.
// 표/마감 같은 실시간 값은 클라이언트에서 소켓 + 폴링으로 즉시 동기화된다.
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
    const room = await getRoom(id, undefined, 30);
    // OG 카드에 스크랩 시점의 1위를 노출 — 메신저가 카드를 캐시하므로
    // "실시간"은 아니고 공유(스크랩)할 때마다 그 시점 최신값이 박힌다.
    const top = [...room.results].sort(
      (a, b) => b.votes - a.votes || a.date.localeCompare(b.date),
    )[0];
    const lead =
      top && top.votes > 0 ? `지금 1위 ${formatDateKR(top.date)} · ` : '';
    const description = `${room.title} — ${lead}참여자 ${room.participantCount}명. 가능한 날짜에 투표해주세요.`;
    return {
      title: `${room.title} · 모일까`,
      description,
      robots,
      openGraph: {
        title: `${room.title} · 모일까`,
        description,
        type: 'website',
        url: `/rooms/${id}`,
      },
      twitter: {
        card: 'summary_large_image',
        title: `${room.title} · 모일까`,
        description,
      },
    };
  } catch {
    return { title: '방 · 모일까', robots };
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
    room = await getRoom(id, undefined, 30);
  } catch (err) {
    notFound = err instanceof ApiError && err.status === 404;
  }

  if (!room) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-12 text-center">
        {/* 삭제/만료된 방이면 '내 방' 목록에서 자동 제거 (일시적 로드 실패는 제외) */}
        {notFound && <ForgetRoomOnMount roomId={id} />}
        <h1 className="flex items-center justify-center gap-1.5 text-xl font-semibold">
          {notFound ? (
            <span>방을 찾을 수 없어요</span>
          ) : (
            <>
              <span aria-hidden>🛠️</span>
              <span>잠깐만요, 서버 점검 중이에요</span>
            </>
          )}
        </h1>
        {/* 서버가 잠깐 끊긴 것을 "링크가 만료됐다" 고 안내하면 친구가 자기 링크를
            잘못된 것으로 오해한다 — 404 일 때만 링크 문제라고 말한다. */}
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {notFound
            ? '링크가 만료됐거나 잘못된 주소일 수 있어요.'
            : '링크는 멀쩡해요! 서버가 잠깐 쉬는 중이라 조금 뒤에 새로고침해주세요.'}
        </p>
        {!notFound && (
          <p className="mt-3 rounded-xl bg-zinc-100 px-3 py-2 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            걱정 마세요! 방이랑 투표한 내용은 그대로 저장돼 있어요.
          </p>
        )}
        <Link
          href="/"
          className="press mt-6 inline-flex h-11 items-center rounded-full bg-zinc-900 px-5 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
        >
          홈으로
        </Link>
      </main>
    );
  }

  return <RoomView roomId={id} initial={room} />;
}

