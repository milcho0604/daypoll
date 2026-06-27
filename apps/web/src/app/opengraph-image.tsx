import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt = '모일까 — 회원가입 없이 날짜 맞추기';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// 카톡 / 슬랙 / 트위터 / 페북 공유 시 미리보기 카드. 1200×630 권장 사이즈.
// amber 톤 + 앱의 핵심 카피 그대로.
export default async function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'linear-gradient(135deg, #fffbeb 0%, #fef3c7 60%, #fcd34d 100%)',
          fontFamily: 'system-ui, sans-serif',
          padding: '64px',
          gap: '24px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '8px 20px',
            background: 'rgba(255, 255, 255, 0.7)',
            borderRadius: '999px',
            fontSize: '24px',
            fontWeight: 600,
            color: '#78350f',
          }}
        >
          🗓️ 가입 0번, 링크 한 줄
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: '128px',
            fontWeight: 800,
            color: '#18181b',
            letterSpacing: '-0.04em',
          }}
        >
          언제 모일까?
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            fontSize: '36px',
            color: '#52525b',
            textAlign: 'center',
            lineHeight: 1.3,
          }}
        >
          <div style={{ display: 'flex' }}>친구들이랑 모일 날짜,</div>
          <div style={{ display: 'flex', fontWeight: 600, color: '#18181b' }}>
            링크 하나로 1분 컷.
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginTop: '24px',
            fontSize: '24px',
            color: '#71717a',
          }}
        >
          <span style={{ display: 'flex' }}>✓ 가입 없음</span>
          <span style={{ display: 'flex' }}>·</span>
          <span style={{ display: 'flex' }}>✓ 광고 없음</span>
          <span style={{ display: 'flex' }}>·</span>
          <span style={{ display: 'flex' }}>✓ 모바일 최적</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
