import CreatedShare from './created-share';

export const metadata = { title: '링크 발급 · 언제모여' };

export default async function CreatedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="flex min-h-dvh flex-col px-5 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-md flex-1">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">방이 만들어졌어요</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            아래 링크를 단톡방에 공유하면 됩니다.
          </p>
        </header>
        <CreatedShare roomId={id} />
      </div>
    </main>
  );
}
