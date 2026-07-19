// 1위 표시용 왕관 아이콘.
//
// 🏆 이모지를 대체한다 — 이모지는 OS/브라우저마다 다른 그림이 렌더되고 채도가 높아
// zinc 기반 톤에서 혼자 튀었다. 단색 선 아이콘이라 currentColor 로 토큰에 맞춘다.
export default function CrownIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {/* 왕관 몸통 — 양 끝과 가운데가 솟은 3봉우리 */}
      <path d="M4 17.5 3 6.8l4.7 3.4L12 4.5l4.3 5.7L21 6.8l-1 10.7z" />
      {/* 아랫단 — 머리에 얹히는 띠 */}
      <path d="M4.4 20.2h15.2" />
    </svg>
  );
}
