import { describe, expect, it } from 'vitest';
import { parsePostSource } from './blog-core';

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
});
