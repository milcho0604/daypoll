import { describe, expect, it } from 'vitest';
import { isHomePath } from './site-header';

// Vercel 이 홈을 프리렌더할 때 경로를 '/index' 로 넣는다 (RSC payload 의
// c: ["", "index"]). usePathname() 이 서버에선 '/index', 브라우저에선 '/' 를
// 주므로, `=== '/'` 로만 비교하면 헤더가 서버·클라에서 다르게 그려져
// 홈 전체가 hydration mismatch (React #418) 로 재렌더된다 (#83).
describe('isHomePath', () => {
  it("브라우저가 주는 '/' 를 홈으로 본다", () => {
    expect(isHomePath('/')).toBe(true);
  });

  it("Vercel 프리렌더가 주는 '/index' 도 홈으로 본다", () => {
    expect(isHomePath('/index')).toBe(true);
  });

  it('pathname 을 아직 모를 때(null/undefined)는 홈이 아니다', () => {
    expect(isHomePath(null)).toBe(false);
    expect(isHomePath(undefined)).toBe(false);
  });

  it.each(['/blog', '/rooms/new', '/rooms/abc123', '/admin', '/privacy', '/indexed'])(
    '%s 는 홈이 아니다',
    (p) => {
      expect(isHomePath(p)).toBe(false);
    },
  );
});
