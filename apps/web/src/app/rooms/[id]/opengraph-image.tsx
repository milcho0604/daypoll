import { ImageResponse } from 'next/og';
import { getRoom } from '@/lib/rooms';

export const runtime = 'nodejs';
export const alt = '언제모여 — 방 공유 카드';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

function formatDateKR(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][dt.getDay()];
  return `${m}월 ${d}일 (${weekday})`;
}

export default async function OgImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let title = '언제모여';
  let topLabel = '아직 결과가 없어요';
  let votes = 0;
  let participantCount = 0;
  try {
    const room = await getRoom(id);
    title = room.title;
    participantCount = room.participantCount;
    const sorted = [...room.results].sort((a, b) => {
      if (b.votes !== a.votes) return b.votes - a.votes;
      return a.date.localeCompare(b.date);
    });
    if (sorted[0] && sorted[0].votes > 0) {
      topLabel = formatDateKR(sorted[0].date);
      votes = sorted[0].votes;
    }
  } catch {
    /* 방 없으면 기본 카드 */
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: '80px',
          background:
            'linear-gradient(135deg, #18181b 0%, #27272a 60%, #3f3f46 100%)',
          color: '#fafafa',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 32, color: '#a1a1aa', display: 'flex' }}>
          언제모여
        </div>
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            marginTop: 16,
            maxWidth: 1040,
            lineHeight: 1.15,
            display: 'flex',
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 32,
            marginTop: 40,
            fontSize: 36,
            color: '#e4e4e7',
          }}
        >
          <span style={{ display: 'flex' }}>1위 · {topLabel}</span>
          {votes > 0 && (
            <span style={{ display: 'flex', color: '#fde68a' }}>
              {votes}표
            </span>
          )}
        </div>
        <div
          style={{
            marginTop: 16,
            fontSize: 28,
            color: '#a1a1aa',
            display: 'flex',
          }}
        >
          참여자 {participantCount}명 · 회원가입 없이 링크로 투표
        </div>
      </div>
    ),
    { ...size },
  );
}
