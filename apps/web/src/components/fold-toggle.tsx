'use client';

// 영역 접기/펼치기 버튼 — 투표 달력·날씨 머리줄 오른쪽에 둔다.
export default function FoldToggle({
  open,
  onToggle,
  label,
}: {
  open: boolean;
  onToggle: () => void;
  label: string; // 스크린리더용: "투표 달력", "날씨"
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={`${label} ${open ? '접기' : '펼치기'}`}
      className="press inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
    >
      {open ? '접기' : '펼치기'}
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
      >
        <path d="m5 8 5 5 5-5" />
      </svg>
    </button>
  );
}
