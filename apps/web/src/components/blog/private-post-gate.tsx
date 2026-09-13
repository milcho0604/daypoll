'use client';

import { useCallback, useEffect, useState } from 'react';
import BlogArticle from './blog-article';
import {
  clearAdminToken,
  getAdminToken,
  setAdminToken,
} from '@/lib/admin';
import type { BlogPost } from '@/lib/blog-types';

export default function PrivatePostGate({ slug }: { slug: string }) {
  const [token, setToken] = useState('');
  const [post, setPost] = useState<BlogPost | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPost = useCallback(async (adminToken: string) => {
    const response = await fetch(
      `/api/blog/private/${encodeURIComponent(slug)}`,
      {
        headers: { 'x-admin-token': adminToken },
        cache: 'no-store',
      },
    );
    if (response.status === 401) return false;
    if (response.status === 429) {
      throw new Error('시도가 너무 많아요. 잠시 후 다시 확인해 주세요.');
    }
    if (response.status === 503) {
      throw new Error('어드민 기능이 아직 설정되지 않았어요.');
    }
    if (response.status === 404) {
      throw new Error('비공개 글을 찾지 못했어요.');
    }
    if (!response.ok) {
      throw new Error('비공개 글을 잠시 불러올 수 없어요.');
    }
    setPost((await response.json()) as BlogPost);
    return true;
  }, [slug]);

  const unlock = useCallback(
    async (nextToken: string) => {
      if (!nextToken.trim()) return;
      setChecking(true);
      setError(null);
      try {
        const normalized = nextToken.trim();
        if (!(await loadPost(normalized))) {
          throw new Error('관리자 토큰이 맞지 않아요.');
        }
        setAdminToken(normalized);
        setToken('');
      } catch (caught) {
        setError((caught as Error).message);
      } finally {
        setChecking(false);
      }
    },
    [loadPost],
  );

  const logout = useCallback(() => {
    clearAdminToken();
    setPost(null);
    setToken('');
    setError(null);
    setChecking(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      const storedToken = getAdminToken();
      if (!storedToken) {
        if (!cancelled) setChecking(false);
        return;
      }
      void loadPost(storedToken)
        .then((authorized) => {
          if (!authorized && !cancelled) {
            clearAdminToken();
            setError('관리자 로그인이 만료됐어요. 다시 확인해 주세요.');
          }
        })
        .catch((caught) => {
          if (!cancelled) setError((caught as Error).message);
        })
        .finally(() => {
          if (!cancelled) setChecking(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [loadPost]);

  if (post) {
    return (
      <BlogArticle
        post={post}
        privateMode
        onAdminLogout={logout}
      />
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col px-5 pt-12 pb-20">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <span className="inline-flex h-9 items-center rounded-full bg-zinc-100 px-3 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          비공개 글
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">
          운영자 확인이 필요해요
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          이 글은 목록과 검색엔진에 공개되지 않아요. 모일까 어드민에서
          사용하는 관리자 권한으로만 확인할 수 있어요.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void unlock(token);
          }}
          className="mt-5 flex flex-col gap-3"
        >
          <label htmlFor="admin-token" className="text-xs font-medium">
            관리자 토큰
          </label>
          <input
            id="admin-token"
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            autoComplete="off"
            placeholder="ADMIN_TOKEN"
            className="h-12 rounded-xl border border-zinc-200 bg-white px-4 text-base outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/20"
          />
          {error && (
            <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={checking || !token.trim()}
            className="press h-12 rounded-full bg-zinc-900 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-white dark:text-zinc-900 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-500"
          >
            {checking ? '확인 중…' : '관리자 권한으로 열기'}
          </button>
        </form>
      </section>
    </main>
  );
}
