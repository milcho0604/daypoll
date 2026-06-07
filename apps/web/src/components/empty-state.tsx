// 빈 상태(empty) 자리에 일관된 톤으로 출력. 큰 이모지 + 친근한 문구.
export default function EmptyState({
  emoji,
  message,
  className = '',
}: {
  emoji: string;
  message: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-2 py-6 text-center ${className}`}
    >
      <span aria-hidden className="text-3xl opacity-80">
        {emoji}
      </span>
      <p className="text-sm text-zinc-500">{message}</p>
    </div>
  );
}
