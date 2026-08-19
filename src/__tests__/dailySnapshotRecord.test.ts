import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { PortfolioStocks } from '@/config/constants';
import { usePortfolioStore } from '@/store/portfolioStore';
import { getTodayKST } from '@/utils/dailySnapshot';

const HOLDINGS: PortfolioStocks = {
  investing: [
    {
      symbol: '005930.KS',
      currency: 'KRW',
      avgCost: 200_000,
      shares: 2,
      targetReturn: 10,
    },
    {
      symbol: 'AAPL',
      currency: 'USD',
      avgCost: 100,
      shares: 3,
      targetReturn: 10,
      purchaseRate: 1300,
    },
  ],
  watching: [],
  sold: [],
};

const COMPLETE_QUOTES = {
  '005930.KS': {
    c: 220_000,
    d: 5_000,
    dp: 2.33,
    h: 222_000,
    l: 215_000,
    o: 216_000,
    pc: 215_000,
    t: 0,
  },
  AAPL: {
    c: 120,
    d: 2,
    dp: 1.69,
    h: 121,
    l: 117,
    o: 118,
    pc: 118,
    t: 0,
  },
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
  globalThis.localStorage?.clear();
});

describe('recordDailySnapshot', () => {
  it('미국 종목이 있으면 실제 USD/KRW 없이 스냅샷을 기록하지 않는다', () => {
    usePortfolioStore.setState({
      stocks: HOLDINGS,
      macroData: COMPLETE_QUOTES,
      dailySnapshots: [],
    });

    usePortfolioStore.getState().recordDailySnapshot();

    expect(usePortfolioStore.getState().dailySnapshots).toEqual([]);
  });

  it('환율이 있어도 보유 종목 시세가 일부만 로드되면 기록하지 않는다', () => {
    usePortfolioStore.setState({
      stocks: HOLDINGS,
      macroData: {
        'USD/KRW': { value: 1450, change: 0, changePercent: 0 },
        '005930.KS': COMPLETE_QUOTES['005930.KS'],
      },
      dailySnapshots: [],
    });

    usePortfolioStore.getState().recordDailySnapshot();

    expect(usePortfolioStore.getState().dailySnapshots).toEqual([]);
  });

  it('모든 시세와 실제 환율이 있으면 정확한 KRW 기준 v2 스냅샷을 기록한다', () => {
    usePortfolioStore.setState({
      stocks: HOLDINGS,
      macroData: {
        ...COMPLETE_QUOTES,
        'USD/KRW': { value: 1450, change: 0, changePercent: 0 },
      },
      dailySnapshots: [],
    });

    usePortfolioStore.getState().recordDailySnapshot();

    expect(usePortfolioStore.getState().dailySnapshots).toEqual([{
      date: getTodayKST(),
      capturedAt: expect.any(String),
      schemaVersion: 2,
      valuationCurrency: 'KRW',
      usdKrw: 1450,
      totalValue: 962_000,
      totalCost: 790_000,
      totalValueKrw: 962_000,
      totalCostKrw: 790_000,
      stocks: [
        {
          symbol: '005930.KS',
          currency: 'KRW',
          avgCost: 200_000,
          shares: 2,
          currentPrice: 220_000,
          purchaseRate: undefined,
        },
        {
          symbol: 'AAPL',
          currency: 'USD',
          avgCost: 100,
          shares: 3,
          currentPrice: 120,
          purchaseRate: 1300,
        },
      ],
    }]);
  });
});
