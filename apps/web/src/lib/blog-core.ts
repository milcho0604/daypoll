import hljs from 'highlight.js/lib/common';
import { decodeHTML } from 'entities';
import { load as parseYaml } from 'js-yaml';
import { Marked, Renderer, type Tokens } from 'marked';
import sanitize from 'sanitize-html';
import type {
  BlogPost,
  PostMeta,
  PostVisibility,
  TocItem,
} from './blog-types';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const CONTROL_CHAR_RE = /[\u0000-\u001F\u007F]/;
const FRONTMATTER_FIELDS = new Set([
  'title',
  'date',
  'updated',
  'publishAt',
  'description',
  'category',
  'tags',
  'visibility',
  'draft',
  'cover',
  'coverAlt',
]);

export function latestPostModifiedDate(
  posts: readonly Pick<PostMeta, 'date' | 'updated'>[],
): string | null {
  return posts.reduce<string | null>((latest, post) => {
    const candidate = post.updated ?? post.date;
    return latest == null || candidate > latest ? candidate : latest;
  }, null);
}

function hasOwn(object: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function parseFrontmatter(
  slug: string,
  raw: string,
): { data: Record<string, unknown>; content: string } {
  const source = raw.replace(/^\uFEFF/, '');
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    throw new Error(`[blog:${slug}] YAML frontmatter가 필요합니다.`);
  }
  let parsed: unknown;
  try {
    parsed = parseYaml(match[1]);
  } catch (error) {
    throw new Error(
      `[blog:${slug}] frontmatter YAML을 읽지 못했습니다: ${(error as Error).message}`,
    );
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`[blog:${slug}] frontmatter는 key: value 객체여야 합니다.`);
  }
  return {
    data: parsed as Record<string, unknown>,
    content: match[2],
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function dateValue(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return stringValue(value);
}

function validDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function assertText(
  value: unknown,
  field: string,
  slug: string,
  maxLength: number,
): string {
  const text = stringValue(value);
  if (!text) throw new Error(`[blog:${slug}] ${field} 값이 필요합니다.`);
  if (CONTROL_CHAR_RE.test(text)) {
    throw new Error(`[blog:${slug}] ${field}에는 제어 문자를 사용할 수 없습니다.`);
  }
  if (text.length > maxLength) {
    throw new Error(
      `[blog:${slug}] ${field} 값은 ${maxLength}자 이하여야 합니다.`,
    );
  }
  return text;
}

function parseDate(value: unknown, field: string, slug: string): string {
  const date = dateValue(value);
  if (!validDate(date)) {
    throw new Error(`[blog:${slug}] ${field}는 YYYY-MM-DD 형식이어야 합니다.`);
  }
  return date;
}

function parseDateTime(value: unknown, field: string, slug: string): string {
  const dateTime = stringValue(value);
  if (!DATETIME_RE.test(dateTime) || Number.isNaN(Date.parse(dateTime))) {
    throw new Error(
      `[blog:${slug}] ${field}는 시간대가 포함된 ISO 8601 형식이어야 합니다.`,
    );
  }
  return dateTime;
}

function parseTags(value: unknown, slug: string): string[] {
  if (!Array.isArray(value) && typeof value !== 'string') {
    throw new Error(`[blog:${slug}] tags는 문자열 또는 문자열 배열이어야 합니다.`);
  }
  const raw = Array.isArray(value)
    ? value
    : value.split(',');
  if (raw.some((tag) => typeof tag !== 'string')) {
    throw new Error(`[blog:${slug}] tags 배열에는 문자열만 사용할 수 있습니다.`);
  }
  const tags = [...new Set(raw.map(stringValue).filter(Boolean))];
  if (tags.length === 0) {
    throw new Error(`[blog:${slug}] tags를 하나 이상 적어 주세요.`);
  }
  if (
    tags.length > 10 ||
    tags.some((tag) => tag.length > 30 || CONTROL_CHAR_RE.test(tag))
  ) {
    throw new Error(
      `[blog:${slug}] tags는 제어 문자 없이 최대 10개, 각 30자 이하여야 합니다.`,
    );
  }
  return tags;
}

function parseVisibility(value: unknown, slug: string): PostVisibility {
  if (value === 'public' || value === 'private') return value;
  throw new Error(
    `[blog:${slug}] visibility는 public 또는 private이어야 합니다.`,
  );
}

function markdownHeadingText(html: string): string {
  const plain = sanitize(html, {
    allowedTags: [],
    allowedAttributes: {},
    transformTags: {
      img: (_tagName, attribs) => ({
        tagName: 'span',
        attribs: {},
        text: attribs.alt ?? '',
      }),
    },
  });
  return decodeHTML(plain).trim();
}

function headingSlug(text: string): string {
  return (
    text
      .normalize('NFKC')
      .toLocaleLowerCase('ko-KR')
      .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
      .trim()
      .replace(/[\s-]+/g, '-') || 'section'
  );
}

function readingStats(markdown: string): {
  wordCount: number;
  readingMinutes: number;
} {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_~|\[\]()-]/g, ' ');
  const segmenter = new Intl.Segmenter('ko-KR', { granularity: 'word' });
  const wordCount = [...segmenter.segment(plain)].filter(
    (segment) => segment.isWordLike,
  ).length;
  return {
    wordCount,
    readingMinutes: Math.max(1, Math.ceil(wordCount / 220)),
  };
}

function renderMarkdown(
  markdown: string,
  slug: string,
): { html: string; toc: TocItem[] } {
  const toc: TocItem[] = [];
  const headingCounts = new Map<string, number>();
  const renderer = new Renderer();

  renderer.heading = function heading({ tokens, depth }: Tokens.Heading) {
    const content = this.parser.parseInline(tokens);
    const title = markdownHeadingText(content);
    const baseId = headingSlug(title);
    const count = headingCounts.get(baseId) ?? 0;
    headingCounts.set(baseId, count + 1);
    const id = count === 0 ? baseId : `${baseId}-${count + 1}`;
    if (depth === 2 || depth === 3) {
      toc.push({ id, title, level: depth });
    }
    return `<h${depth} id="${escapeHtml(id)}">${content}<a class="heading-anchor" href="#${escapeHtml(id)}" aria-label="${escapeHtml(title)} 제목 링크 복사"><span aria-hidden="true">#</span></a></h${depth}>`;
  };

  renderer.code = function code({ text, lang }: Tokens.Code) {
    const requested = (lang ?? '').trim().split(/\s+/)[0].toLowerCase();
    const knownLanguage = requested && hljs.getLanguage(requested);
    const highlighted = knownLanguage
      ? hljs.highlight(text, {
          language: requested,
          ignoreIllegals: true,
        }).value
      : escapeHtml(text);
    const language = knownLanguage ? requested : 'plaintext';
    return `<pre data-language="${escapeHtml(language)}"><code class="hljs language-${escapeHtml(language)}">${highlighted}</code></pre>`;
  };

  const parser = new Marked();
  parser.setOptions({ gfm: true, breaks: false, renderer });
  const rawHtml = parser.parse(markdown, { async: false });
  const html = sanitize(rawHtml, {
    allowedTags: [
      ...sanitize.defaults.allowedTags,
      'img',
      'input',
      'span',
    ],
    allowedAttributes: {
      a: ['href', 'name', 'target', 'rel', 'class', 'aria-label'],
      img: [
        'src',
        'alt',
        'title',
        'width',
        'height',
        'loading',
        'decoding',
      ],
      code: ['class'],
      pre: ['class', 'data-language'],
      h1: ['id'],
      h2: ['id'],
      h3: ['id'],
      h4: ['id'],
      h5: ['id'],
      h6: ['id'],
      span: ['class', 'aria-hidden'],
      input: ['type', 'checked', 'disabled', 'class', 'aria-label'],
      td: ['align'],
      th: ['align'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a(tagName, attribs) {
        const href = attribs.href ?? '';
        const safeAttribs = { ...attribs };
        delete safeAttribs.target;
        delete safeAttribs.rel;
        if (/^(?:https?:)?\/\//i.test(href)) {
          return {
            tagName,
            attribs: {
              ...safeAttribs,
              target: '_blank',
              rel: 'noopener noreferrer',
            },
          };
        }
        return { tagName, attribs: safeAttribs };
      },
      img(tagName, attribs) {
        if (!attribs.alt?.trim()) {
          throw new Error(
            `[blog:${slug}] 본문 이미지에는 대체 텍스트가 필요합니다.`,
          );
        }
        const src = attribs.src ?? '';
        if (
          !src.startsWith('/') ||
          src.startsWith('//') ||
          src.split('/').includes('..') ||
          /[\s?#]/.test(src)
        ) {
          throw new Error(
            `[blog:${slug}] 본문 이미지는 /로 시작하는 안전한 내부 경로여야 합니다.`,
          );
        }
        return {
          tagName,
          attribs: { ...attribs, loading: 'lazy', decoding: 'async' },
        };
      },
      input(tagName, attribs) {
        if (attribs.type?.toLowerCase() !== 'checkbox') {
          return { tagName: 'span', attribs: {} };
        }
        const checked = Object.prototype.hasOwnProperty.call(
          attribs,
          'checked',
        );
        return {
          tagName,
          attribs: {
            type: 'checkbox',
            disabled: '',
            'aria-label': checked
              ? '완료된 체크리스트 항목'
              : '미완료 체크리스트 항목',
            ...(checked ? { checked: '' } : {}),
          },
        };
      },
    },
  });
  return { html, toc };
}

function parseMeta(
  slug: string,
  data: Record<string, unknown>,
  body: string,
): PostMeta {
  const unknownFields = Object.keys(data).filter(
    (field) => !FRONTMATTER_FIELDS.has(field),
  );
  if (unknownFields.length > 0) {
    throw new Error(
      `[blog:${slug}] 지원하지 않는 frontmatter 필드입니다: ${unknownFields.join(', ')}`,
    );
  }
  if (!SLUG_RE.test(slug)) {
    throw new Error(
      `[blog:${slug}] 파일명은 영문 소문자·숫자·하이픈만 사용할 수 있습니다.`,
    );
  }
  const title = assertText(data.title, 'title', slug, 100);
  const description = assertText(data.description, 'description', slug, 200);
  const date = parseDate(data.date, 'date', slug);
  const updated = hasOwn(data, 'updated')
    ? parseDate(data.updated, 'updated', slug)
    : undefined;
  if (updated && updated < date) {
    throw new Error(`[blog:${slug}] updated는 date보다 빠를 수 없습니다.`);
  }
  const publishAt = hasOwn(data, 'publishAt')
    ? parseDateTime(data.publishAt, 'publishAt', slug)
    : undefined;
  const category = assertText(data.category, 'category', slug, 30);
  const tags = parseTags(data.tags, slug);
  const visibility = parseVisibility(data.visibility, slug);
  if (visibility === 'private' && publishAt) {
    throw new Error(
      `[blog:${slug}] publishAt 예약 발행은 public 글에서만 사용할 수 있습니다.`,
    );
  }
  if (hasOwn(data, 'draft') && typeof data.draft !== 'boolean') {
    throw new Error(`[blog:${slug}] draft는 true 또는 false여야 합니다.`);
  }
  const draft = data.draft === true;
  const cover = hasOwn(data, 'cover')
    ? assertText(data.cover, 'cover', slug, 500)
    : undefined;
  if (
    cover &&
    (!cover.startsWith('/') ||
      cover.startsWith('//') ||
      cover.split('/').includes('..') ||
      /[\s?#]/.test(cover))
  ) {
    throw new Error(
      `[blog:${slug}] cover는 /로 시작하는 안전한 내부 경로여야 합니다.`,
    );
  }
  if (visibility === 'private' && cover) {
    throw new Error(
      `[blog:${slug}] private 글의 cover는 공개 폴더에 노출되므로 사용할 수 없습니다.`,
    );
  }
  if (!cover && hasOwn(data, 'coverAlt')) {
    throw new Error(`[blog:${slug}] coverAlt는 cover가 있을 때만 사용할 수 있습니다.`);
  }
  const coverAlt = cover
    ? hasOwn(data, 'coverAlt')
      ? assertText(data.coverAlt, 'coverAlt', slug, 200)
      : `${title} 대표 이미지`
    : undefined;
  const { readingMinutes, wordCount } = readingStats(body);
  return {
    slug,
    title,
    date,
    updated,
    publishAt,
    description,
    category,
    tags,
    cover,
    coverAlt,
    visibility,
    draft,
    readingMinutes,
    wordCount,
  };
}

export function parsePostSource(slug: string, raw: string): BlogPost {
  const parsed = parseFrontmatter(slug, raw);
  const body = parsed.content.trim();
  if (!body) throw new Error(`[blog:${slug}] 본문이 비어 있습니다.`);
  const meta = parseMeta(slug, parsed.data, body);
  const { html, toc } = renderMarkdown(body, slug);
  if (/<h1\b/i.test(html)) {
    throw new Error(
      `[blog:${slug}] 본문은 ## 제목부터 시작해 주세요. 페이지 제목이 이미 H1입니다.`,
    );
  }
  if (meta.visibility === 'private' && /<img\b/i.test(html)) {
    throw new Error(
      `[blog:${slug}] private 글에는 공개 경로로 새는 이미지를 넣을 수 없습니다.`,
    );
  }
  return { meta, html, toc };
}
