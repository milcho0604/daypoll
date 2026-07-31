import {
  classifyReferrer,
  classifySource,
  normalizePath,
} from './analytics.service';

describe('normalizePath — 카디널리티 방어', () => {
  it('알려진 라우트는 그대로', () => {
    expect(normalizePath('/')).toBe('/');
    expect(normalizePath('/rooms/new')).toBe('/rooms/new');
    expect(normalizePath('/blog')).toBe('/blog');
    expect(normalizePath('/privacy')).toBe('/privacy');
    expect(normalizePath('/terms')).toBe('/terms');
  });

  it('방 id 는 하나로 뭉갬', () => {
    expect(normalizePath('/rooms/NClOsdPOViPk')).toBe('/rooms/[id]');
    expect(normalizePath('/rooms/abc/created')).toBe('/rooms/[id]/created');
    expect(normalizePath('/rooms/abc?x=1#y')).toBe('/rooms/[id]');
  });

  it('블로그 슬러그는 하나로 뭉갬', () => {
    expect(normalizePath('/blog/rate-limit-postmortem')).toBe('/blog/[slug]');
  });

  it('어드민 하위 경로는 /admin 하나로', () => {
    expect(normalizePath('/admin')).toBe('/admin');
    expect(normalizePath('/admin/rooms/123')).toBe('/admin');
  });

  it('임의 경로 스팸은 전부 /other 로 — 행 무한 증식 차단', () => {
    expect(normalizePath('/spam-aaaa-0001')).toBe('/other');
    expect(normalizePath('/x/y/z')).toBe('/other');
    expect(normalizePath('a'.repeat(500))).toBe('/other');
    expect(normalizePath('/rooms/new/whatever')).toBe('/other');
  });
});

describe('classifyReferrer — 소스 라벨', () => {
  it('빈/파싱불가 referrer 는 direct', () => {
    expect(classifyReferrer('')).toBe('direct');
    expect(classifyReferrer(null)).toBe('direct');
    expect(classifyReferrer('not a url')).toBe('direct');
  });

  it('우리 도메인은 internal', () => {
    expect(classifyReferrer('https://moilga.com/rooms/x')).toBe('internal');
    expect(classifyReferrer('https://www.moilga.com/')).toBe('internal');
    expect(classifyReferrer('https://preview.vercel.app/')).toBe('internal');
  });

  it('알려진 유입원은 매핑', () => {
    expect(classifyReferrer('https://search.naver.com/x')).toBe('naver');
    expect(classifyReferrer('https://www.google.com/search')).toBe('google');
    expect(classifyReferrer('https://t.co/abc')).toBe('x');
  });

  it('미분류 외부 host 는 other 하나로 — 임의 host 스팸 차단', () => {
    expect(classifyReferrer('https://aaa1.example/')).toBe('other');
    expect(classifyReferrer('https://aaa2.example/')).toBe('other');
    expect(classifyReferrer(`https://${'h'.repeat(200)}.evil/`)).toBe('other');
  });
});

describe('classifySource — ref 힌트 화이트리스트', () => {
  it('알려진 ref 힌트가 referrer 보다 우선', () => {
    expect(classifySource('https://aaa.example/', 'kakao')).toBe('kakao');
    expect(classifySource(null, 'twitter')).toBe('x'); // alias
  });

  it('임의 ref 문자열은 무시하고 referrer 분류로 폴백', () => {
    expect(classifySource('https://search.naver.com/', 'zzz-spam')).toBe(
      'naver',
    );
    expect(classifySource(null, 'zzz-spam')).toBe('direct');
  });
});
