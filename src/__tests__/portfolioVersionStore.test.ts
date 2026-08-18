import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { PortfolioStocks } from '@/config/constants';
import { emptyReconciliationSummary } from '@/lib/portfolioReconciliation';
import { usePortfolioStore } from '@/store/portfolioStore';

const BEFORE: PortfolioStocks = {
  investing: [{
    symbol: 'AAPL',
    avgCost: 100,
    shares: 2,
    targetReturn: 10,
    broker: 'toss',
  }],
  watching: [],
  sold: [],
};

const AFTER: PortfolioStocks = {
  investing: [{
    symbol: 'AAPL',
    avgCost: 120,
    shares: 3,
    targetReturn: 10,
    broker: 'toss',
  }],
  watching: [],
  sold: [],
};

beforeAll(() => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      get length() { return values.size; },
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => [...values.keys()][index] ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    } satisfies Storage,
  });
});

afterAll(() => {
  Reflect.deleteProperty(globalThis, 'localStorage');
});

afterEach(() => {
  usePortfolioStore.getState().resetPortfolio();
});

describe('포트폴리오 버전 저장소', () => {
  it('가져오기 전 상태를 보관하고 복원 자체도 다시 취소할 수 있다', () => {
    usePortfolioStore.setState({
      stocks: BEFORE,
      portfolioImportHistory: [],
      lastImportCheckpoint: null,
    });

    const importId = usePortfolioStore.getState().commitPortfolioImport(
      AFTER,
      'CSV 가져오기',
      {
        summary: { ...emptyReconciliationSummary(), updated: 1 },
        changes: [{
          kind: 'updated',
          symbol: 'AAPL',
          broker: 'toss',
          category: 'investing',
          currency: 'USD',
          avgCost: 120,
          shares: 3,
          fields: [
            { field: 'avgCost', before: 100, after: 120 },
            { field: 'shares', before: 2, after: 3 },
          ],
        }],
      },
    );

    expect(usePortfolioStore.getState().stocks).toEqual(AFTER);
    expect(usePortfolioStore.getState().portfolioImportHistory[0]).toMatchObject({
      id: importId,
      stocks: BEFORE,
      summary: { updated: 1 },
    });

    expect(usePortfolioStore.getState().restoreLastPortfolioImport(importId)).toBe(true);
    const restoredState = usePortfolioStore.getState();
    expect(restoredState.stocks).toEqual(BEFORE);
    expect(restoredState.portfolioImportHistory).toHaveLength(2);

    const undoRestoreId = restoredState.lastImportCheckpoint?.id;
    expect(undoRestoreId).toBeTruthy();
    expect(restoredState.restorePortfolioVersion(undoRestoreId!)).toBe(true);
    expect(usePortfolioStore.getState().stocks).toEqual(AFTER);
  });

  it('계정 초기화 시 다른 사용자의 복구 기록도 함께 제거한다', () => {
    usePortfolioStore.setState({
      stocks: BEFORE,
      portfolioImportHistory: [{
        id: 'private-version',
        createdAt: new Date().toISOString(),
        source: 'CSV 가져오기',
        stocks: BEFORE,
        kind: 'import',
        summary: emptyReconciliationSummary(),
        changes: [],
        excludedCount: 0,
      }],
      dbPortfolioStatus: 'ok',
    });

    usePortfolioStore.getState().resetPortfolio();

    expect(usePortfolioStore.getState().portfolioImportHistory).toEqual([]);
    expect(usePortfolioStore.getState().dbPortfolioStatus).toBe('unknown');
    expect(usePortfolioStore.getState().portfolioSyncStatus).toBe('idle');
    expect(usePortfolioStore.getState().portfolioCloudLoadStatus).toBe('guest');
  });

  it('JSON 기록 복원은 현재 종목을 복구 지점으로 남기고 장기 스냅샷을 합친다', () => {
    usePortfolioStore.setState({
      stocks: BEFORE,
      dailySnapshots: [{
        date: '2026-07-28',
        totalValue: 220,
        totalCost: 200,
        stocks: [],
      }],
      portfolioImportHistory: [],
      lastImportCheckpoint: null,
    });

    usePortfolioStore.getState().restorePortfolioBackup({
      stocks: AFTER,
      snapshots: [{
        date: '2026-07-27',
        totalValue: 210,
        totalCost: 200,
        stocks: [],
      }],
      history: [],
    });

    const restored = usePortfolioStore.getState();
    expect(restored.stocks).toEqual(AFTER);
    expect(restored.dailySnapshots.map((snapshot) => snapshot.date)).toEqual([
      '2026-07-27',
      '2026-07-28',
    ]);
    expect(restored.portfolioImportHistory[0]).toMatchObject({
      source: 'JSON 복원 전 현재 기록',
      stocks: BEFORE,
    });
  });
});
