import CreatedShare from './created-share';

export const metadata = {
  title: '링크 발급 · 언제모여',
  robots: { index: false, follow: false },
};

export default async function CreatedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="flex min-h-dvh flex-col px-5 pt-8 pb-16 sm:pt-12 sm:pb-20">
      <div className="mx-auto w-full max-w-md flex-1">
        <header className="mb-6 fade-up">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            ✨ 방 생성 완료
          </span>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            친구들한테 뿌리기만 하면 끝!
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            링크를 단톡방에 공유하거나, QR을 옆자리에 비추세요.
          </p>
        </header>
        <CreatedShare roomId={id} />
      </div>
    </main>
  );
}
