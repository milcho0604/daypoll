import 'server-only';

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { cache } from 'react';
import { parsePostSource } from './blog-core';
import type { AdjacentPosts, BlogPost, PostMeta } from './blog-types';

const BLOG_DIR =
  process.env.BLOG_E2E_FIXTURES === '1'
    ? join(process.cwd(), 'e2e', 'fixtures', 'content')
    : join(process.cwd(), 'content', 'blog');
const VALID_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PREVIEW_DRAFTS = process.env.NODE_ENV !== 'production';

export type { AdjacentPosts, BlogPost, PostMeta, TocItem } from './blog-types';

type PostQuery = {
  includePrivate?: boolean;
  includeDrafts?: boolean;
  now?: Date;
};

const readAllPosts = cache(function readAllPosts(): BlogPost[] {
  let files: string[];
  try {
    files = readdirSync(BLOG_DIR)
      .filter((file) => file.endsWith('.md'))
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  return files
    .map((file) => {
      const slug = file.slice(0, -3);
      const source = readFileSync(join(BLOG_DIR, file), 'utf8');
      const post = parsePostSource(slug, source);
      if (
        post.meta.cover &&
        !existsSync(join(process.cwd(), 'public', post.meta.cover.slice(1)))
      ) {
        throw new Error(
          `[blog:${slug}] cover 파일을 찾을 수 없습니다: ${post.meta.cover}`,
        );
      }
      for (const match of post.html.matchAll(/<img\s+[^>]*src="([^"]+)"/g)) {
        const imagePath = match[1];
        if (
          !imagePath.startsWith('/') ||
          !existsSync(join(process.cwd(), 'public', imagePath.slice(1)))
        ) {
          throw new Error(
            `[blog:${slug}] 본문 이미지 파일을 찾을 수 없습니다: ${imagePath}`,
          );
        }
      }
      return post;
    })
    .sort((a, b) => {
      return (
        b.meta.date.localeCompare(a.meta.date) ||
        a.meta.slug.localeCompare(b.meta.slug)
      );
    });
});

function visible(post: BlogPost, query: PostQuery): boolean {
  const previewingDraft =
    post.meta.draft && (query.includeDrafts ?? PREVIEW_DRAFTS);
  if (post.meta.draft && !previewingDraft) return false;
  if (post.meta.visibility === 'private' && !query.includePrivate) return false;
  if (
    !previewingDraft &&
    post.meta.visibility === 'public' &&
    post.meta.publishAt &&
    new Date(post.meta.publishAt) > (query.now ?? new Date())
  ) {
    return false;
  }
  return true;
}

export function isPostPubliclyVisible(
  post: BlogPost,
  now = new Date(),
): boolean {
  if (post.meta.visibility !== 'public') return false;
  if (post.meta.draft) return PREVIEW_DRAFTS;
  return !post.meta.publishAt || new Date(post.meta.publishAt) <= now;
}

export function getAllPosts(query: PostQuery = {}): PostMeta[] {
  return readAllPosts()
    .filter((post) => visible(post, query))
    .map((post) => post.meta);
}

export const getPost = cache(function getPost(slug: string): BlogPost | null {
  if (!VALID_SLUG.test(slug)) return null;
  return readAllPosts().find((post) => post.meta.slug === slug) ?? null;
});

export function getRelatedPosts(slug: string, limit = 3): PostMeta[] {
  const current = getPost(slug);
  if (!current || current.meta.visibility !== 'public') return [];
  const tagSet = new Set(current.meta.tags);
  return getAllPosts()
    .filter((post) => post.slug !== slug)
    .map((post) => ({
      post,
      score:
        (post.category === current.meta.category ? 4 : 0) +
        post.tags.filter((tag) => tagSet.has(tag)).length,
    }))
    .filter(({ score }) => score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.post.date.localeCompare(a.post.date),
    )
    .slice(0, limit)
    .map(({ post }) => post);
}

export function getAdjacentPosts(slug: string): AdjacentPosts {
  const posts = getAllPosts();
  const index = posts.findIndex((post) => post.slug === slug);
  if (index < 0) return { newer: null, older: null };
  return {
    newer: posts[index - 1] ?? null,
    older: posts[index + 1] ?? null,
  };
}

export function getBlogFacets(): { categories: string[]; tags: string[] } {
  const posts = getAllPosts();
  return {
    categories: [...new Set(posts.map((post) => post.category))].sort((a, b) =>
      a.localeCompare(b, 'ko-KR'),
    ),
    tags: [...new Set(posts.flatMap((post) => post.tags))].sort((a, b) =>
      a.localeCompare(b, 'ko-KR'),
    ),
  };
}
