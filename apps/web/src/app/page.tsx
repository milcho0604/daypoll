import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-between px-6 py-10 sm:py-16">
      <section className="flex flex-1 flex-col items-center justify-center gap-10 text-center">
        <div className="fade-up flex flex-col items-center gap-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
            <span aria-hidden>🗓️</span>
            가입 0번, 링크 한 줄
          </span>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            언제 모여?
          </h1>
          <p className="max-w-md text-base text-zinc-600 dark:text-zinc-400 sm:text-lg">
            친구들이랑 모일 날 정하느라
            <br className="sm:hidden" />
            단톡방 흐트러질 때.
            <br />
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              링크 하나로 1분 컷.
            </span>
          </p>
        </div>

        <Link
          href="/rooms/new"
          className="press inline-flex h-14 items-center gap-2 rounded-full bg-zinc-900 px-8 text-base font-semibold text-white shadow-lg shadow-zinc-900/20 transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:shadow-white/20 dark:hover:bg-zinc-200"
        >
          방 만들기
          <span aria-hidden>→</span>
        </Link>

        <section className="grid w-full grid-cols-3 gap-3 fade-up">
          {STEPS.map((s, i) => (
            <article
              key={s.title}
              className="rounded-2xl border border-zinc-200 bg-white/60 p-3 text-left backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="text-xl">{s.emoji}</div>
              <div className="mt-1 text-xs font-semibold">{s.title}</div>
              <div className="mt-0.5 text-[10px] leading-snug text-zinc-500">
                {s.body}
              </div>
            </article>
          ))}
        </section>
      </section>

      <footer className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-zinc-400">
        <span>가입 없음</span>
        <span aria-hidden>·</span>
        <span>광고 없음</span>
        <span aria-hidden>·</span>
        <span>모바일 최적화</span>
      </footer>
    </main>
  );
}

const STEPS = [
  {
    emoji: '✏️',
    title: '날짜 후보 정하기',
    body: '캘린더에서 가능한 날 쓱',
  },
  {
    emoji: '🔗',
    title: '단톡방에 링크',
    body: '친구가 들어와 가능한 날 체크',
  },
  {
    emoji: '🏆',
    title: '1위 날짜 결정',
    body: '실시간 순위로 한눈에',
  },
];
