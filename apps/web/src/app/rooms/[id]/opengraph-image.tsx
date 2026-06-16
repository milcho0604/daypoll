import { ImageResponse } from 'next/og';
import { getRoom } from '@/lib/rooms';
import { formatDateKRLong } from '@/lib/format';

export const runtime = 'nodejs';
export const alt = '언제모여 — 방 공유 카드';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

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
      topLabel = formatDateKRLong(sorted[0].date);
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
            fontSize: 56,
            fontWeight: 700,
            marginTop: 12,
            maxWidth: 1040,
            lineHeight: 1.15,
            display: 'flex',
          }}
        >
          {title}
        </div>
        {votes > 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 24,
              marginTop: 40,
            }}
          >
            <span style={{ display: 'flex', fontSize: 72 }}>🏆</span>
            <span
              style={{
                display: 'flex',
                fontSize: 96,
                fontWeight: 800,
                letterSpacing: '-0.03em',
                color: '#fcd34d',
              }}
            >
              {topLabel}
            </span>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 24px',
                borderRadius: 999,
                background: 'rgba(252, 211, 77, 0.18)',
                fontSize: 36,
                color: '#fde68a',
              }}
            >
              {votes}표
            </span>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              marginTop: 40,
              fontSize: 44,
              color: '#e4e4e7',
            }}
          >
            📅 {topLabel} — 먼저 투표해보세요
          </div>
        )}
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
