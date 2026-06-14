"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof window !== "undefined") {
      console.error("[whenever] page error:", error);
    }
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-6 px-5 text-center">
      <div className="text-6xl" aria-hidden="true">🌧️</div>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        앗, 뭔가 잘못됐어요
      </h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        잠깐 다시 해보면 보통 풀려요.
        <br />
        계속 안 되면 알려주시면 바로 고칠게요.
      </p>
      {error.digest && (
        <p className="font-mono text-[11px] text-zinc-400">
          ref: {error.digest}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={reset}
          className="press lift inline-flex h-12 items-center justify-center rounded-full bg-zinc-900 px-6 text-sm font-semibold text-white dark:bg-white dark:text-zinc-900"
        >
          다시 해보기
        </button>
        <Link
          href="/"
          className="press inline-flex h-12 items-center justify-center rounded-full border border-zinc-200 px-6 text-sm font-medium text-zinc-700 dark:border-zinc-800 dark:text-zinc-300"
        >
          홈으로 가기
        </Link>
      </div>
    </main>
  );
}
