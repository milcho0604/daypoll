import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

// iOS 홈 화면에 추가 시 아이콘. 사각 (Apple 가 알아서 둥글림 처리).
export default function AppleIcon() {
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
          fontSize: '120px',
          fontWeight: 800,
          fontFamily: 'system-ui, sans-serif',
          letterSpacing: '-0.04em',
        }}
      >
        모
      </div>
    ),
    { ...size },
  );
}
