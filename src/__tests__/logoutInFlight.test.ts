import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';

const m = vi.hoisted(() => ({
  effects: [] as Array<() => void | (() => void)>,
  load: vi.fn(), save: vi.fn(), stocks: vi.fn(), snapshots: vi.fn(), history: vi.fn(),
}));
vi.mock('react', () => ({
  useEffect: (effect: () => void | (() => void)) => m.effects.push(effect),
  useCallback: (fn: unknown) => fn,
  useRef: (value: unknown) => ({ current: value }),
}));
vi.mock('@/lib/portfolioSync', () => ({ loadPortfolio: m.load, savePortfolioToDB: m.save }));
vi.mock('@/lib/apiLogger', () => ({ logApiCall: vi.fn() }));
vi.mock('@/store/portfolioStore', () => {
  const state = {
    stocks: { investing: [], watching: [], sold: [] }, dailySnapshots: [], portfolioImportHistory: [],
    dbPortfolioStatus: 'unknown', setStocksFromDB: m.stocks, setSnapshotsFromDB: m.snapshots,
    setPortfolioHistoryFromDB: m.history, setDbPortfolioStatus: vi.fn(),
    setPortfolioSyncStatus: vi.fn(), setPortfolioCloudLoadStatus: vi.fn(),
  };
  return { usePortfolioStore: Object.assign((selector: (s: typeof state) => unknown) => selector(state), {
    getState: () => state, subscribe: () => () => {},
  }) };
});
import { usePortfolioSync } from '@/hooks/usePortfolioSync';

let cleanups: Array<() => void> = [];
beforeEach(() => {
  vi.clearAllMocks(); m.effects.length = 0;
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('document', new EventTarget());
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() });
});
afterEach(() => { cleanups.forEach(fn => fn()); cleanups = []; vi.unstubAllGlobals(); });

it.each([false, true])('늦은 클라우드 응답: 정리=%s일 때 계정 경계를 지킨다', async cleared => {
  let finish!: (value: unknown) => void;
  m.load.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  usePortfolioSync({ id: 'test-user' } as User);
  for (const effect of m.effects) { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); }
  expect(m.load).toHaveBeenCalledWith('test-user');
  if (cleared) window.dispatchEvent(new Event('solb-user-storage-clearing'));
  finish({ status: 'ok', stocks: { investing: [{ symbol: 'AAPL', shares: 2 }], watching: [], sold: [] },
    dailySnapshots: [], portfolioHistory: [], updatedAt: '2026-09-10T00:00:00Z' });
  await Promise.resolve();
  if (cleared) {
    expect(m.stocks).not.toHaveBeenCalled();
    expect(m.snapshots).not.toHaveBeenCalled();
    expect(m.history).not.toHaveBeenCalled();
    expect(m.save).not.toHaveBeenCalled();
  } else expect(m.stocks).toHaveBeenCalled();
});
