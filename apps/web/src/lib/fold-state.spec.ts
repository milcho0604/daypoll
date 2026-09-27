import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFold, writeFold } from './fold-state';

describe('fold-state (방별 접힘 기억)', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('저장 안 했으면 null (기본값을 쓰라는 뜻)', () => {
    expect(readFold('r1', 'calendar')).toBeNull();
  });

  it('접음/펼침을 방·영역별로 따로 기억', () => {
    writeFold('r1', 'calendar', false);
    writeFold('r1', 'weather', true);
    writeFold('r2', 'calendar', true);
    expect(readFold('r1', 'calendar')).toBe(false);
    expect(readFold('r1', 'weather')).toBe(true);
    expect(readFold('r2', 'calendar')).toBe(true);
  });

  it('저장소가 막혀도 터지지 않는다 (사생활 모드)', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('SecurityError');
        },
        setItem: () => {
          throw new Error('QuotaExceeded');
        },
      },
    });
    expect(readFold('r1', 'calendar')).toBeNull();
    expect(() => writeFold('r1', 'calendar', false)).not.toThrow();
  });
});
