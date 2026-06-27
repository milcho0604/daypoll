// content/blog/*.md 를 읽어 메타데이터 파싱 + 마크다운 → HTML 렌더.
// 외부 frontmatter 라이브러리 없이 단순 포맷만 직접 파싱한다.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { cache } from 'react';
import { marked } from 'marked';

const BLOG_DIR = join(process.cwd(), 'content', 'blog');

export type PostMeta = {
  slug: string;
  title: string;
  date: string; // YYYY-MM-DD
  description: string;
  tags: string[];
};

function unquote(s: string): string {
  return s.trim().replace(/^["']|["']$/g, '');
}

function parseTags(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((t) => unquote(t))
    .filter(Boolean);
}

function parseFrontmatter(raw: string): {
  data: Record<string, string>;
  body: string;
} {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  const data: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (kv) data[kv[1]] = kv[2].trim();
  }
  return { data, body: m[2] };
}

// 콘텐츠는 우리가 작성한 빌드타임 .md(신뢰됨)지만, 실수로 raw <script> 등이
// 섞여도 렌더되지 않도록 위험 태그/속성을 제거한다. 완전한 sanitizer 는 아니고
// 신뢰 콘텐츠에 대한 방어적 보강(defense-in-depth)이다.
function sanitizeHtml(html: string): string {
  return html
    .replace(
      /<\s*(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
      '',
    )
    .replace(/<\s*(script|style|iframe|object|embed)\b[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(
      /(href|src)\s*=\s*("\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi,
      '$1="#"',
    );
}

function toMeta(slug: string, data: Record<string, string>): PostMeta {
  return {
    slug,
    title: unquote(data.title ?? slug),
    date: unquote(data.date ?? ''),
    description: unquote(data.description ?? ''),
    tags: parseTags(data.tags),
  };
}

export function getAllPosts(): PostMeta[] {
  let files: string[] = [];
  try {
    files = readdirSync(BLOG_DIR).filter((f) => f.endsWith('.md'));
  } catch {
    return [];
  }
  return files
    .map((f) => {
      const { data } = parseFrontmatter(readFileSync(join(BLOG_DIR, f), 'utf8'));
      return toMeta(f.replace(/\.md$/, ''), data);
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1)); // 최신순
}

// generateMetadata 와 페이지 본문이 같은 렌더에서 각각 호출 → React cache 로
// 슬러그당 파일 읽기·marked 파싱을 1회로 메모이즈(빌드 비용 절감).
export const getPost = cache(_getPost);

function _getPost(slug: string): { meta: PostMeta; html: string } | null {
  let raw: string;
  try {
    raw = readFileSync(join(BLOG_DIR, `${slug}.md`), 'utf8');
  } catch {
    return null;
  }
  const { data, body } = parseFrontmatter(raw);
  const html = sanitizeHtml(
    marked.parse(body, { async: false, gfm: true }) as string,
  );
  return { meta: toMeta(slug, data), html };
}
