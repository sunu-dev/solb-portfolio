import { afterEach, expect, it, vi } from 'vitest';
import snapshot from '../../public/stock-catalog.json';
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
afterEach(() => vi.unstubAllGlobals());

it('원본 서버 장애 시 거래소별 마지막 목록과 실제 기준일을 유지한다', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('upstream unavailable')));
  const { getStockCatalog } = await import('@/lib/stockCatalog');
  const catalog = await getStockCatalog();
  expect(catalog.stocks).toHaveLength(snapshot.stocks.length);
  expect(catalog.sources.every(source => source.fallback && source.updatedAt === snapshot.updatedAt)).toBe(true);
  expect(new Set(catalog.stocks.map(stock => stock.symbol)).size).toBe(catalog.stocks.length);
});
