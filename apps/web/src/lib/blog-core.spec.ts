import { describe, expect, it } from 'vitest';
import { latestPostModifiedDate, parsePostSource } from './blog-core';

function source(
  body: string,
  frontmatter = '',
): string {
  return `---
title: "안전한 Markdown 블로그"
date: "2026-08-17"
description: "파서와 공개 정책을 검증하는 테스트 글입니다."
category: "개발 기록"
tags: [markdown, test]
visibility: public
draft: false
${frontmatter}---

${body}`;
}

describe('parsePostSource', () => {
  it('메타데이터, 읽는 시간, 목차와 중복 제목 앵커를 만든다', () => {
    const post = parsePostSource(
      'safe-markdown',
      source(`## 같은 제목

본문입니다.

### 하위 제목

설명입니다.

## 같은 제목

마무리입니다.`),
    );

    expect(post.meta.visibility).toBe('public');
    expect(post.meta.readingMinutes).toBeGreaterThanOrEqual(1);
    expect(post.meta.wordCount).toBeGreaterThan(0);
    expect(post.toc).toEqual([
      { id: '같은-제목', title: '같은 제목', level: 2 },
      { id: '하위-제목', title: '하위 제목', level: 3 },
      { id: '같은-제목-2', title: '같은 제목', level: 2 },
    ]);
    expect(post.html).toContain('id="같은-제목-2"');
  });

  it('코드를 서버에서 강조하고 위험한 HTML과 링크를 제거한다', () => {
    const post = parsePostSource(
      'safe-code',
      source(`## 코드

\`\`\`ts
const answer = 42;
\`\`\`

\`\`\`bash
# 코드 안의 주석은 본문 H1이 아닙니다.
echo ok
\`\`\`

<script>alert('xss')</script>

[위험한 링크](javascript:alert('xss'))`),
    );

    expect(post.html).toContain('hljs-keyword');
    expect(post.html).not.toContain('<script');
    expect(post.html).not.toContain('javascript:');
  });

  it('필수 공개 정책과 날짜 형식을 엄격히 검증한다', () => {
    expect(() =>
      parsePostSource(
        'missing-visibility',
        source('## 본문').replace('visibility: public\n', ''),
      ),
    ).toThrow('visibility는 public 또는 private');
    expect(() =>
      parsePostSource(
        'bad-date',
        source('## 본문').replace('2026-08-17', '2026-02-30'),
      ),
    ).toThrow('YYYY-MM-DD');
    expect(() => parsePostSource('bad-heading', source('# 잘못된 제목'))).toThrow(
      '## 제목부터',
    );
    expect(() =>
      parsePostSource(
        'bad-cover',
        source('## 본문', 'cover: "//external.example/image.png"\n'),
      ),
    ).toThrow('안전한 내부 경로');
  });

  it('private 글에서 공개 이미지 경로가 새는 것을 막는다', () => {
    const privateSource = source('## 본문\n\n![민감한 이미지](/private/leak.png)')
      .replace('visibility: public', 'visibility: private');

    expect(() => parsePostSource('private-image', privateSource)).toThrow(
      '이미지를 넣을 수 없습니다',
    );

    const privateText = source('## 내부 기록\n\n텍스트 본문입니다.').replace(
      'visibility: public',
      'visibility: private',
    );
    expect(parsePostSource('private-text', privateText).meta.visibility).toBe(
      'private',
    );
  });

  it('private 글의 축약 참조형 이미지도 차단한다', () => {
    const privateShortcutImage = source(
      '## 내부 기록\n\n![민감한 이미지]\n\n[민감한 이미지]: /private/leak.png',
    ).replace('visibility: public', 'visibility: private');

    expect(() =>
      parsePostSource('private-shortcut-image', privateShortcutImage),
    ).toThrow('이미지를 넣을 수 없습니다');
  });

  it('raw HTML H1도 페이지 제목과 충돌하지 못하게 차단한다', () => {
    expect(() =>
      parsePostSource(
        'raw-html-heading',
        source('## 정상 제목\n\n<h1>우회한 페이지 제목</h1>'),
      ),
    ).toThrow('## 제목부터');
  });

  it('외부 링크와 GFM 체크박스만 안전한 속성으로 정규화한다', () => {
    const post = parsePostSource(
      'safe-interactions',
      source(`## 안전한 상호작용

[외부 링크](//example.com/path)

<a href="/inside" target="_blank" rel="opener">내부 링크</a>

<input type="password" value="phishing">

- [x] 완료`),
    );

    expect(post.html).toContain(
      '<a href="//example.com/path" target="_blank" rel="noopener noreferrer">외부 링크</a>',
    );
    expect(post.html).toContain('<a href="/inside">내부 링크</a>');
    expect(post.html).not.toContain('type="password"');
    expect(post.html).not.toContain('phishing');
    expect(post.html).toMatch(/<input[^>]+type="checkbox"[^>]+disabled/);
    expect(post.html).toContain('aria-label="완료된 체크리스트 항목"');
  });

  it('스크립트·이벤트 핸들러·위험한 URL을 정화한다', () => {
    const post = parsePostSource(
      'xss-corpus',
      source(`## XSS corpus

<svg onload="alert(1)"><script>alert(2)</script></svg>

<img src="/safe.png" alt="안전" onerror="alert(3)">

<a href="java&#x73;cript:alert(4)">위험</a>

<div style="background:url(javascript:alert(5))">스타일</div>`),
    );

    expect(post.html).not.toMatch(/<script|<svg|onload|onerror|javascript:|style=/i);
    expect(post.html).toContain('<img src="/safe.png" alt="안전"');
  });

  it('제목의 inline HTML과 entity를 목차용 일반 텍스트로 정규화한다', () => {
    const post = parsePostSource(
      'plain-toc-title',
      source(`## API <em>안전</em> &amp; [계약][docs]

본문입니다.

[docs]: https://example.com/docs`),
    );

    expect(post.toc).toEqual([
      { id: 'api-안전-계약', title: 'API 안전 & 계약', level: 2 },
    ]);
  });

  it('frontmatter 오타·잘못된 타입·제어 문자를 조용히 무시하지 않는다', () => {
    expect(() =>
      parsePostSource(
        'unknown-field',
        source('## 본문', 'titel: "오타"\n'),
      ),
    ).toThrow('지원하지 않는 frontmatter');

    expect(() =>
      parsePostSource(
        'bad-tag-type',
        source('## 본문').replace(
          'tags: [markdown, test]',
          'tags: [markdown, 123]',
        ),
      ),
    ).toThrow('문자열');

    expect(() =>
      parsePostSource(
        'bad-cover-type',
        source('## 본문', 'cover: 123\n'),
      ),
    ).toThrow('cover');

    expect(() =>
      parsePostSource(
        'orphan-cover-alt',
        source('## 본문', 'coverAlt: "설명만 있음"\n'),
      ),
    ).toThrow('cover가 있을 때만');

    expect(() =>
      parsePostSource(
        'control-character',
        source('## 본문').replace(
          'title: "안전한 Markdown 블로그"',
          'title: "제어\\x01문자"',
        ),
      ),
    ).toThrow('제어 문자를');
  });

  it('공개 본문 이미지에는 접근 가능한 대체 텍스트를 요구한다', () => {
    expect(() =>
      parsePostSource(
        'missing-image-alt',
        source('## 본문\n\n![](/blog/images/example.webp)'),
      ),
    ).toThrow('대체 텍스트');
  });

  it('피드와 사이트맵의 최신일은 게시 순서가 아니라 실제 수정일로 계산한다', () => {
    expect(
      latestPostModifiedDate([
        { date: '2026-08-01' },
        { date: '2026-07-01', updated: '2026-09-01' },
        { date: '2026-06-01', updated: '2026-07-15' },
      ]),
    ).toBe('2026-09-01');
    expect(latestPostModifiedDate([])).toBeNull();
  });
});
