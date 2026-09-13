import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { parsePostSource } from '../src/lib/blog-core';
import type { BlogPost } from '../src/lib/blog-types';

const BLOG_DIR = join(process.cwd(), 'content', 'blog');
const PUBLIC_DIR = join(process.cwd(), 'public');
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function fail(message: string): never {
  console.error(`[blog] ${message}`);
  process.exit(1);
}

function kstDate(): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function createPost(): void {
  const slug = process.argv[3];
  if (!slug || !SLUG_RE.test(slug)) {
    fail('slug는 영문 소문자·숫자·하이픈 형식으로 입력해 주세요.');
  }
  const privateMode = process.argv.includes('--private');
  const publishAt = argument('--publish-at');
  if (privateMode && publishAt) {
    fail('--private와 --publish-at은 함께 사용할 수 없습니다.');
  }
  const title = argument('--title')?.trim() || slug.replaceAll('-', ' ');
  const destination = join(BLOG_DIR, `${slug}.md`);
  mkdirSync(BLOG_DIR, { recursive: true });
  const source = `---
title: ${yamlString(title)}
date: ${yamlString(kstDate())}
description: "목록과 검색 결과에 표시할 200자 이내의 소개문"
category: "개발 기록"
tags: [기록]
visibility: ${privateMode ? 'private' : 'public'}
draft: true${publishAt ? `\npublishAt: ${yamlString(publishAt)}` : ''}
---

## 첫 번째 제목

본문을 작성해 주세요.
`;
  // 파일을 만들기 전에 동일한 운영 파서로 옵션·메타데이터를 검증한다.
  parsePostSource(slug, source);
  try {
    writeFileSync(destination, source, { encoding: 'utf8', flag: 'wx' });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      fail(`이미 존재하는 글입니다: ${destination}`);
    }
    throw error;
  }
  console.log(`[blog] 새 초안을 만들었습니다: ${destination}`);
}

function imageSources(post: BlogPost): string[] {
  return [...post.html.matchAll(/<img\s+[^>]*src="([^"]+)"/g)].map(
    (match) => match[1],
  );
}

function localBlogLinks(post: BlogPost): string[] {
  return [...post.html.matchAll(/<a\s+[^>]*href="\/blog\/([^"#/?]+)[^"]*"/g)]
    .map((match) => match[1])
    .filter(Boolean);
}

function checkPosts(): void {
  const files = existsSync(BLOG_DIR)
    ? readdirSync(BLOG_DIR).filter((file) => file.endsWith('.md')).sort()
    : [];
  const posts = files.map((file) => {
    const slug = file.slice(0, -3);
    return parsePostSource(slug, readFileSync(join(BLOG_DIR, file), 'utf8'));
  });
  const bySlug = new Map(posts.map((post) => [post.meta.slug, post]));

  for (const post of posts) {
    const assets = [post.meta.cover, ...imageSources(post)].filter(
      (path): path is string => Boolean(path),
    );
    for (const asset of assets) {
      if (!asset.startsWith('/') || !existsSync(join(PUBLIC_DIR, asset.slice(1)))) {
        throw new Error(
          `[blog:${post.meta.slug}] 이미지 파일을 찾을 수 없습니다: ${asset}`,
        );
      }
    }
    for (const target of localBlogLinks(post)) {
      const linked = bySlug.get(target);
      if (!linked) {
        throw new Error(
          `[blog:${post.meta.slug}] 연결된 글을 찾을 수 없습니다: /blog/${target}`,
        );
      }
      if (
        post.meta.visibility === 'public' &&
        linked.meta.visibility === 'private'
      ) {
        throw new Error(
          `[blog:${post.meta.slug}] public 글에서 private 글 링크를 노출할 수 없습니다: /blog/${target}`,
        );
      }
      if (
        post.meta.visibility === 'public' &&
        !post.meta.draft &&
        linked.meta.draft
      ) {
        throw new Error(
          `[blog:${post.meta.slug}] 발행 글에서 draft 링크를 노출할 수 없습니다: /blog/${target}`,
        );
      }
      const targetPublishAt = linked.meta.publishAt
        ? Date.parse(linked.meta.publishAt)
        : null;
      const sourcePublishAt = post.meta.publishAt
        ? Date.parse(post.meta.publishAt)
        : Date.now();
      if (
        post.meta.visibility === 'public' &&
        !post.meta.draft &&
        targetPublishAt != null &&
        targetPublishAt > Date.now() &&
        sourcePublishAt < targetPublishAt
      ) {
        throw new Error(
          `[blog:${post.meta.slug}] 먼저 공개되는 글에서 미래 예약 글 링크를 노출할 수 없습니다: /blog/${target}`,
        );
      }
    }
  }
  console.log(`[blog] ${posts.length}개 글의 Markdown·메타데이터·이미지·링크 검증 완료`);
}

const command = process.argv[2];
if (command === 'new') createPost();
else if (command === 'check') checkPosts();
else fail('사용법: blog.ts <new|check>');
