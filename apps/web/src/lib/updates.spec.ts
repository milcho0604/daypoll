import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { UPDATES } from './updates';

// 사용자용 업데이트 소식(/updates)과 개발용 CHANGELOG.md 가 어긋나지 않게.
const changelog = readFileSync(resolve(__dirname, '../../../../CHANGELOG.md'), 'utf8');
const released = [...changelog.matchAll(/^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})$/gm)].map(
  (m) => ({ version: m[1], date: m[2] }),
);

describe('updates ↔ CHANGELOG', () => {
  it('CHANGELOG 에 릴리스가 있다', () => {
    expect(released.length).toBeGreaterThan(0);
  });

  it('가장 최신 버전이 같다', () => {
    expect(UPDATES[0].version).toBe(released[0].version);
  });

  it('업데이트 소식의 각 버전·날짜가 CHANGELOG 와 같다', () => {
    for (const u of UPDATES) {
      const r = released.find((x) => x.version === u.version);
      expect(r, `CHANGELOG 에 ${u.version} 없음`).toBeDefined();
      expect(r?.date).toBe(u.date);
    }
  });

  it('최신이 위 (버전 내림차순)', () => {
    const key = (v: string) => v.split('.').map((n) => n.padStart(4, '0')).join('.');
    const vs = UPDATES.map((u) => key(u.version));
    expect([...vs].sort().reverse()).toEqual(vs);
  });
});
