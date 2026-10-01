import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ error: vi.fn(), updated: vi.fn(), symbols: [] as string[], entries: {} as Record<string, unknown> }));
vi.mock('react', () => ({ useCallback: (fn: unknown) => fn, useEffect: vi.fn(), useRef: (v: unknown) => ({ current: v }) }));
vi.mock('@/store/portfolioStore', () => {
  const state = {
    getAllSymbols: () => m.symbols,
    updateMacroEntry: (key: string, value: unknown) => { m.entries[key] = value; },
    setNetworkError: m.error, setLastUpdate: m.updated,
    get macroData() { return m.entries; },
  };
  return { usePortfolioStore: Object.assign(() => state, { getState: () => state }), delay: vi.fn() };
});
import { MACRO_IND } from '@/config/constants';
import { useStockData } from '@/hooks/useStockData';
const indices = MACRO_IND.filter(i => i.type === 'stock' && i.symbol).map(i => i.symbol!);
const q = { c: 100, d: 1, dp: 1 };
beforeEach(() => {
  vi.clearAllMocks(); m.symbols = []; m.entries = {};
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());
function response(quotes: Record<string, unknown>) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ quotes, usdKrw: q }) }));
}
it('보유 종목이 없어도 지수 수신이 성공하면 경고를 지운다', async () => {
  response(Object.fromEntries(indices.map(s => [s, q])));
  await useStockData().fetchAllQuotes();
  expect(m.entries['S&P 500']).toHaveProperty('value', 100);
  expect(m.error).toHaveBeenLastCalledWith(null);
  expect(m.updated).toHaveBeenCalledOnce();
});
it('과거 캐시가 있어도 이번 전체 실패를 숨기지 않는다', async () => {
  m.entries.AAPL = q;
  response({});
  await useStockData().fetchAllQuotes();
  expect(m.error).toHaveBeenLastCalledWith(expect.stringContaining('시세 데이터를 불러오지 못했어요'));
  expect(m.updated).not.toHaveBeenCalled();
});
it('지수는 성공해도 보유 종목이 빠지면 일부 실패를 알린다', async () => {
  m.symbols = ['AAPL'];
  response(Object.fromEntries(indices.map(s => [s, q])));
  await useStockData().fetchAllQuotes();
  expect(m.error).toHaveBeenLastCalledWith(expect.stringContaining('일부 시세'));
  expect(m.updated).not.toHaveBeenCalled();
});
it('실패 뒤 정상 응답이면 남아 있던 경고가 해제된다', async () => {
  response({});
  const hook = useStockData();
  await hook.fetchAllQuotes();
  response(Object.fromEntries(indices.map(s => [s, q])));
  await hook.fetchAllQuotes();
  expect(m.error).toHaveBeenLastCalledWith(null);
});
