import { describe, expect, it, vi } from 'vitest';
import {
  findCanonicalSnapshotNearDate,
  findSnapshotNearDate,
  getSnapshotKrwTotals,
  needsNewSnapshot,
  prune,
  pruneForLongTerm,
  type DailySnapshot,
} from '@/utils/dailySnapshot';

function legacy(date: string): DailySnapshot {
  return {
    date,
    totalValue: 220_000,
    totalCost: 200_000,
    stocks: [],
  };
}

function canonical(date: string): DailySnapshot {
  return {
    date,
    schemaVersion: 2,
    valuationCurrency: 'KRW',
    usdKrw: 1459.41,
    totalValue: 541_070.2,
    totalCost: 460_000,
    totalValueKrw: 541_070.2,
    totalCostKrw: 460_000,
    stocks: [],
  };
}

describe('daily snapshot currency schema', () => {
  it('기준 통화를 알 수 없는 v1 스냅샷은 KRW 비교에서 제외한다', () => {
    const old = legacy('2026-07-27');

    expect(getSnapshotKrwTotals(old)).toBeNull();
    expect(findCanonicalSnapshotNearDate([old], '2026-07-27')).toBeNull();
  });

  it('v2 스냅샷만 명시적 KRW 합계로 읽는다', () => {
    const snapshot = canonical('2026-07-27');

    expect(getSnapshotKrwTotals(snapshot)).toEqual({
      totalValueKrw: 541_070.2,
      totalCostKrw: 460_000,
    });
    expect(findCanonicalSnapshotNearDate([snapshot], '2026-07-27')).toBe(snapshot);
  });

  it('같은 날짜에 v1이 있어도 v2 기록을 허용하고 prune에서 v2를 우선한다', () => {
    const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
    const old = legacy(today);
    const next = canonical(today);

    expect(needsNewSnapshot([old])).toBe(true);
    expect(needsNewSnapshot([next])).toBe(false);
    expect(prune([old, next])).toEqual([next]);
  });

  it('기준일과 더 가까워도 미래 스냅샷은 과거 비교값으로 선택하지 않는다', () => {
    const past = canonical('2026-07-24');
    const future = canonical('2026-07-26');

    expect(findSnapshotNearDate(
      [future, past],
      '2026-07-25',
      7,
    )).toBe(past);
    expect(findSnapshotNearDate(
      [future],
      '2026-07-25',
      7,
    )).toBeNull();
  });

  it('최근 1년은 일별, 5년까지는 주별, 그 이전은 월별로 장기 보존한다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-28T03:00:00.000Z'));
    try {
      const snapshots = [
        canonical('2019-04-02'),
        canonical('2019-04-28'),
        canonical('2024-01-01'),
        canonical('2024-01-03'),
        canonical('2026-07-20'),
        canonical('2026-07-27'),
      ];

      expect(pruneForLongTerm(snapshots).map((snapshot) => snapshot.date)).toEqual([
        '2019-04-28',
        '2024-01-03',
        '2026-07-20',
        '2026-07-27',
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('같은 날 값이 줄었어도 capturedAt이 최신인 상태를 보존한다', () => {
    const older = {
      ...canonical('2026-07-27'),
      capturedAt: '2026-07-27T01:00:00.000Z',
      totalValue: 900_000,
      totalValueKrw: 900_000,
    };
    const newer = {
      ...canonical('2026-07-27'),
      capturedAt: '2026-07-27T02:00:00.000Z',
      totalValue: 300_000,
      totalValueKrw: 300_000,
    };

    expect(prune([older, newer])).toEqual([newer]);
  });
});
