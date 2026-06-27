// content/blog/*.md 를 읽어 메타데이터 파싱 + 마크다운 → HTML 렌더.
// 외부 frontmatter 라이브러리 없이 단순 포맷만 직접 파싱한다.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
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

export function getPost(slug: string): { meta: PostMeta; html: string } | null {
  let raw: string;
  try {
    raw = readFileSync(join(BLOG_DIR, `${slug}.md`), 'utf8');
  } catch {
    return null;
  }
  const { data, body } = parseFrontmatter(raw);
  const html = marked.parse(body, { async: false, gfm: true }) as string;
  return { meta: toMeta(slug, data), html };
}
