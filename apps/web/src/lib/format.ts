// 날짜 포맷 공용 유틸 — 'YYYY-MM-DD' 문자열을 한국어 라벨로.
// 이전엔 room-view / page / opengraph-image 에 각각 복붙돼 있어 어긋날 위험이 있었다.

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function parts(iso: string): { m: number; d: number; weekday: string } {
  const [y, m, d] = iso.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return { m, d, weekday };
}

// 'M/D (요일)' — 리스트/칩 등 좁은 영역용 (기본).
export function formatDateKR(iso: string): string {
  const { m, d, weekday } = parts(iso);
  return `${m}/${d} (${weekday})`;
}

// 'M월 D일 (요일)' — OG 카드 등 넓은 영역용.
export function formatDateKRLong(iso: string): string {
  const { m, d, weekday } = parts(iso);
  return `${m}월 ${d}일 (${weekday})`;
}
