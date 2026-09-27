import { BadRequestException } from '@nestjs/common';
import { normalizePlaceUrl } from './place-url';

describe('normalizePlaceUrl', () => {
  it('빈 값은 링크 없음(null)', () => {
    expect(normalizePlaceUrl(undefined)).toBeNull();
    expect(normalizePlaceUrl(null)).toBeNull();
    expect(normalizePlaceUrl('   ')).toBeNull();
  });

  it('지도 공유 링크는 그대로 통과 (쿼리·fragment 보존)', () => {
    expect(normalizePlaceUrl(' https://naver.me/5abcDEF ')).toBe(
      'https://naver.me/5abcDEF',
    );
    expect(
      normalizePlaceUrl('https://map.naver.com/p/entry/place/123?c=15.00,0,0#x'),
    ).toBe('https://map.naver.com/p/entry/place/123?c=15.00,0,0#x');
    expect(normalizePlaceUrl('http://place.map.kakao.com/8888')).toBe(
      'http://place.map.kakao.com/8888',
    );
  });

  it('호스트는 소문자·punycode 로 정규화 — 유사 문자 위장이 드러난다', () => {
    expect(normalizePlaceUrl('https://NAVER.ME/x')).toBe('https://naver.me/x');
    // 키릴 \u0430 (U+0430)
    expect(normalizePlaceUrl('https://n\u0430ver.me/x')).toBe(
      'https://xn--nver-53d.me/x',
    );
  });

  it.each([
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'ftp://example.com/x',
    'naver.me/abc', // 스킴 없음
    '//naver.me/abc', // 프로토콜 상대
    'https://naver.me@evil.example/x', // userinfo 위장
    'https://user:pw@example.com/',
    'https://naver.me/a b', // 가운데 공백
    'https://naver.me/\u202Egnp.exe', // 방향 제어
    'https://naver.me/\u200Bx', // 폭 없는 공백
    'https://naver.me/\nx',
    'https://',
  ])('거부: %s', (bad) => {
    expect(() => normalizePlaceUrl(bad)).toThrow(BadRequestException);
  });

  it('500자 초과 거부 (잘라서 저장하지 않는다)', () => {
    const long = 'https://example.com/' + 'a'.repeat(490);
    expect(() => normalizePlaceUrl(long)).toThrow(BadRequestException);
    const ok = 'https://example.com/' + 'a'.repeat(480);
    expect(normalizePlaceUrl(ok)).toBe(ok);
  });
});
