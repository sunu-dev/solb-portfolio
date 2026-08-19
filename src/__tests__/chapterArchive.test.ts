import { beforeEach, describe, expect, it } from 'vitest';
import { autoArchiveLastMonth } from '@/utils/chapterArchive';

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

beforeEach(() => values.clear());

describe('monthly chapter archive', () => {
  it('KST 월 경계에서 말일 장 마감 데이터까지 포함하고 같은 달을 중복 저장하지 않는다', () => {
    const archived = autoArchiveLastMonth({
      now: new Date('2026-07-01T03:00:00.000Z'),
      stocks: {
        investing: [{
          symbol: 'AAPL',
          avgCost: 100,
          shares: 1,
          targetReturn: 10,
          currency: 'USD',
          purchaseRate: 1400,
          notes: [{ date: '2026-06-30', emoji: '', text: '월말 메모' }],
        }],
        watching: [],
        sold: [],
      },
      macroData: {
        'USD/KRW': { value: 1400, change: 0, changePercent: 0 },
      },
      rawCandles: {
        AAPL: {
          s: 'ok',
          t: [
            Date.parse('2026-06-01T01:00:00.000Z') / 1000,
            Date.parse('2026-06-30T06:00:00.000Z') / 1000,
          ],
          c: [100, 120],
          h: [101, 121],
          l: [99, 119],
          o: [100, 120],
          v: [1, 1],
        },
      },
      snapshots: [],
    });

    expect(archived).toMatchObject({
      chapterId: '2026-06',
      monthLabel: '6월',
      championSymbol: 'AAPL',
      championPctReturn: 20,
      notesCount: 1,
    });
    expect(autoArchiveLastMonth({
      now: new Date('2026-07-02T03:00:00.000Z'),
      stocks: {
        investing: [{
          symbol: 'AAPL',
          avgCost: 100,
          shares: 1,
          targetReturn: 10,
        }],
        watching: [],
        sold: [],
      },
      macroData: {},
      rawCandles: {},
      snapshots: [],
    })).toBeNull();
  });
});
