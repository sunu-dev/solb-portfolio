import { describe, it, expect } from 'vitest';
import { ECON_RELEASES, ECON_SHORT_LABEL, nextEconRelease, formatReleaseKst } from '@/config/econCalendar';

describe('econCalendar', () => {
  it('전 항목이 UTC ISO이고 시간순 정합적이다', () => {
    for (const r of ECON_RELEASES) {
      expect(r.at, r.label).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
      expect(Number.isNaN(new Date(r.at).getTime())).toBe(false);
    }
  });

  it('다음 발표는 미래 중 가장 이른 것', () => {
    const next = nextEconRelease(new Date('2026-09-01T00:00:00Z'));
    expect(next?.id).toBe('us-jobs');
    expect(next?.at).toBe('2026-09-04T12:30:00Z');
  });

  it('발표 시각이 지나면 그 항목은 후보에서 빠진다', () => {
    const next = nextEconRelease(new Date('2026-09-04T13:00:00Z'));
    expect(next?.id).toBe('us-cpi');
    expect(next?.at).toBe('2026-09-11T12:30:00Z');
  });

  it('미래 일정이 없으면 null — 낡은 일정을 보여주지 않는다 (연도 넘김 가드)', () => {
    expect(nextEconRelease(new Date('2027-01-01T00:00:00Z'))).toBeNull();
  });

  it('KST 표기 — 서머타임 구간(9월)은 21:30', () => {
    const r = ECON_RELEASES.find(x => x.at === '2026-09-11T12:30:00Z')!;
    expect(formatReleaseKst(r)).toBe('9.11(금) 21:30');
  });

  it('KST 표기 — 표준시 구간(12월)은 22:30', () => {
    const r = ECON_RELEASES.find(x => x.at === '2026-12-10T13:30:00Z')!;
    expect(formatReleaseKst(r)).toBe('12.10(목) 22:30');
  });

  it('모든 발표 id에 축약 라벨이 있다 (배지 오버플로 방지)', () => {
    for (const r of ECON_RELEASES) {
      expect(ECON_SHORT_LABEL[r.id], r.id).toBeTruthy();
      // 배지는 좁은 폭에서 렌더되므로 축약 라벨은 짧게 유지한다
      expect(ECON_SHORT_LABEL[r.id].length).toBeLessThanOrEqual(7);
    }
  });

  it('FOMC 결정은 KST 새벽에 떨어진다 (9/16 18:00Z → 9/17 03:00 KST)', () => {
    const r = ECON_RELEASES.find(x => x.id === 'fomc' && x.at.startsWith('2026-09-16'))!;
    expect(formatReleaseKst(r)).toBe('9.17(목) 03:00');
  });
});
