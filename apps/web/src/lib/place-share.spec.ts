import { describe, expect, it } from 'vitest';
import { parsePlaceShare, providerOf, safeHref } from './place-share';

describe('parsePlaceShare', () => {
  it('네이버 지도 공유 텍스트 — 이름과 링크', () => {
    const r = parsePlaceShare(
      '[네이버 지도]\n을지로 노가리골목\n서울 중구 을지로13길 19\nhttps://naver.me/5abcDEF',
    );
    expect(r).toEqual({
      url: 'https://naver.me/5abcDEF',
      urls: ['https://naver.me/5abcDEF'],
      name: '을지로 노가리골목',
    });
  });

  it('카카오맵 — 마커와 이름이 한 줄', () => {
    const r = parsePlaceShare(
      '[카카오맵] 성수 연무장 카페\n서울 성동구 연무장길 12\nhttps://kko.to/AbC123',
    );
    expect(r.name).toBe('성수 연무장 카페');
    expect(r.url).toBe('https://kko.to/AbC123');
  });

  it('CRLF 줄바꿈도 같은 결과', () => {
    const r = parsePlaceShare(
      '[네이버 지도]\r\n곱창집\r\n서울 마포구 ...\r\nhttps://naver.me/x',
    );
    expect(r.name).toBe('곱창집');
  });

  it('지도 호스트 링크 + 이름 한 줄 (마커 없음)', () => {
    const r = parsePlaceShare('소문난 국밥 https://map.naver.com/p/entry/place/123');
    expect(r.name).toBe('소문난 국밥');
    expect(r.url).toBe('https://map.naver.com/p/entry/place/123');
  });

  it('URL 만 — 링크만 채우고 이름은 비운다', () => {
    expect(parsePlaceShare('https://naver.me/abc')).toEqual({
      url: 'https://naver.me/abc',
      urls: ['https://naver.me/abc'],
      name: null,
    });
  });

  it('형식 모르는 텍스트의 첫 줄을 이름으로 우기지 않는다', () => {
    const r = parsePlaceShare('여기 어때? 분위기 좋대\nhttps://blog.example.com/post/1');
    expect(r.name).toBeNull();
    expect(r.url).toBe('https://blog.example.com/post/1');
  });

  it('주소·전화·앱 안내 줄은 이름으로 안 잡는다', () => {
    const r = parsePlaceShare(
      '[네이버 지도]\n서울 중구 을지로 1\n02-123-4567\nhttps://naver.me/x',
    );
    expect(r.name).toBeNull();
  });

  it('링크가 여러 개면 url 은 비우고 목록만 — 사용자가 고른다', () => {
    const r = parsePlaceShare('A https://naver.me/a\nB https://kko.to/b');
    expect(r.url).toBeNull();
    expect(r.urls).toEqual(['https://naver.me/a', 'https://kko.to/b']);
  });

  it('링크 끝에 붙은 괄호·마침표 제거, 쿼리는 보존', () => {
    const r = parsePlaceShare('(https://map.kakao.com/?q=곱창&x=1).');
    expect(r.url).toBe('https://map.kakao.com/?q=곱창&x=1');
  });

  it('링크 없는 텍스트', () => {
    expect(parsePlaceShare('그냥 삼겹살')).toEqual({ url: null, urls: [], name: null });
  });

  it('40자 넘는 줄은 이름으로 안 넣는다', () => {
    const r = parsePlaceShare(`[네이버 지도]\n${'가'.repeat(41)}\nhttps://naver.me/x`);
    expect(r.name).toBeNull();
  });
});

describe('providerOf', () => {
  it('정확한 호스트로만 판정', () => {
    expect(providerOf('https://map.naver.com/p/1')).toEqual({ label: '네이버 지도', kind: 'map' });
    expect(providerOf('https://place.map.kakao.com/1')?.label).toBe('카카오맵');
    // 단축 링크는 지도라고 단정하지 않는다
    expect(providerOf('https://naver.me/x')).toEqual({ label: '네이버', kind: 'link' });
  });

  it('위장 호스트는 실제 호스트로 보인다', () => {
    expect(providerOf('https://naver.me.evil.example/x')?.label).toBe('naver.me.evil.example');
    expect(providerOf('https://naver.me@evil.example/x')?.label).toBe('evil.example');
    // 키릴 a — punycode 로 드러난다
    expect(providerOf(`https://n${String.fromCharCode(0x430)}ver.me/x`)?.label).toBe(
      'xn--nver-53d.me',
    );
  });

  it('모르는 호스트는 www. 만 떼고 그대로', () => {
    expect(providerOf('https://www.example.com/a')?.label).toBe('example.com');
  });

  it('http(s) 가 아니면 null', () => {
    expect(providerOf('javascript:alert(1)')).toBeNull();
    expect(providerOf('not a url')).toBeNull();
  });
});

describe('safeHref', () => {
  it('http(s) 만 통과', () => {
    expect(safeHref('https://naver.me/x')).toBe('https://naver.me/x');
    expect(safeHref('javascript:alert(1)')).toBeNull();
    expect(safeHref('data:text/html,x')).toBeNull();
    expect(safeHref(null)).toBeNull();
  });
});
