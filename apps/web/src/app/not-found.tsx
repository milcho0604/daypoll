import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-6 px-5 text-center">
      <div className="text-6xl" aria-hidden="true">🧭</div>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        길을 잃었네요
      </h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        찾으시는 페이지가 없거나 링크가 만료됐어요.
        <br />
        혹시 단톡방에서 받은 링크면 친구한테 다시 받아보세요.
      </p>
      <div className="flex flex-col gap-2">
        <Link
          href="/"
          className="press lift inline-flex h-12 items-center justify-center rounded-full bg-zinc-900 px-6 text-sm font-semibold text-white dark:bg-white dark:text-zinc-900"
        >
          홈으로 가기
        </Link>
        <Link
          href="/rooms/new"
          className="press inline-flex h-12 items-center justify-center rounded-full border border-zinc-200 px-6 text-sm font-medium text-zinc-700 dark:border-zinc-800 dark:text-zinc-300"
        >
          새 방 만들기
        </Link>
      </div>
    </main>
  );
}
