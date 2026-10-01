import { afterEach, describe, expect, it, vi } from 'vitest';
const items = Array.from({ length: 5001 }, (_, i) => ({ symbol: `X${i}`, description: `종목${i}` }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe('검색 목록 비동기 로딩', () => {
  it('늦은 정적 목록이 먼저 도착한 최신 목록을 덮어쓰지 않는다', async () => {
    let resolveStatic!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn((url: string) => url === '/stock-catalog.json'
      ? new Promise<Response>(resolve => { resolveStatic = resolve; })
      : Promise.resolve(Response.json({ stocks: [...items, { symbol: 'LIVE', description: '새종목' }] }))));
    const { subscribeSearchCatalog, getSearchCatalogState } = await import('@/lib/stockSearchClient');
    const stop = subscribeSearchCatalog(() => {});
    await vi.waitFor(() => expect(getSearchCatalogState().loading).toBe(false));
    resolveStatic(Response.json({ stocks: items }));
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(getSearchCatalogState().index.some(entry => entry.item.symbol === 'LIVE')).toBe(true);
    stop();
  });
  it('두 경로가 실패하면 빈 검색 결과와 구분한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const { subscribeSearchCatalog, getSearchCatalogState } = await import('@/lib/stockSearchClient');
    const stop = subscribeSearchCatalog(() => {});
    await vi.waitFor(() => expect(getSearchCatalogState().error).toBe(true));
    expect(getSearchCatalogState().loading).toBe(false);
    stop();
  });
});
