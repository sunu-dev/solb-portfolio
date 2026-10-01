import { createStockSearchIndex } from './stockSearchIndex';
import type { CatalogStock } from './stockMasterParser';

type SearchCatalogState = { index: ReturnType<typeof createStockSearchIndex>; loading: boolean; error: boolean };
let state: SearchCatalogState = { index: createStockSearchIndex([]), loading: true, error: false };
let loadedAt = 0;
let pending: Promise<void> | undefined;
const listeners = new Set<(state: SearchCatalogState) => void>();
export const getSearchCatalogState = () => state;

export function subscribeSearchCatalog(listener: (state: SearchCatalogState) => void) {
  listeners.add(listener);
  listener(state);
  if (!pending && Date.now() - loadedAt > 3600000) {
    let liveApplied = false;
    let succeeded = false;
    const load = async (url: string, live: boolean) => {
      const response = await fetch(url, { signal: AbortSignal.timeout(live ? 12000 : 5000) });
      if (!response.ok) throw new Error('catalog unavailable');
      const data = await response.json();
      if (!Array.isArray(data.stocks) || data.stocks.length < 5000) throw new Error('incomplete catalog');
      if (data.stocks.some((item: CatalogStock) => typeof item.symbol !== 'string' || typeof item.description !== 'string')) throw new Error('invalid catalog');
      succeeded = true;
      if (!live && liveApplied) return;
      if (live) liveApplied = true;
      state = { index: createStockSearchIndex(data.stocks), loading: false, error: false };
      for (const notify of listeners) notify(state);
    };
    pending = Promise.allSettled([
      load('/stock-catalog.json', false), load('/api/search/catalog', true),
    ]).then(() => {
      loadedAt = succeeded ? Date.now() : 0;
      if (!succeeded) {
        state = { ...state, loading: false, error: true };
        for (const notify of listeners) notify(state);
      }
    }).finally(() => { pending = undefined; });
  }
  return () => { listeners.delete(listener); };
}
