import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

// PWA / 브라우저 탭 아이콘. amber 그라데이션 + "모" 한 글자.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)',
          color: '#ffffff',
          fontSize: '320px',
          fontWeight: 800,
          fontFamily: 'system-ui, sans-serif',
          letterSpacing: '-0.04em',
          borderRadius: '96px',
        }}
      >
        모
      </div>
    ),
    { ...size },
  );
}
