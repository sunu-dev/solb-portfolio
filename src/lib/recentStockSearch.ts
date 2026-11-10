export type RecentStock = { symbol: string; description: string };
export const RECENT_SEARCH_KEY = 'solb_recent_searches';
const MAX_RECENT = 5;
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;

export function getRecent(storage?: StoragePort): RecentStock[] {
  try {
    const value: unknown = JSON.parse((storage ?? localStorage).getItem(RECENT_SEARCH_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    return value.flatMap((item): RecentStock[] => {
      if (!item || typeof item.symbol !== 'string' || typeof item.description !== 'string') return [];
      const symbol = item.symbol.trim().toUpperCase();
      if (!symbol || seen.has(symbol)) return [];
      seen.add(symbol);
      return [{ symbol, description: item.description }];
    }).slice(0, MAX_RECENT);
  } catch { return []; }
}

export function saveRecent(item: RecentStock, storage?: StoragePort) {
  try {
    const target = storage ?? localStorage;
    const symbol = item.symbol.trim().toUpperCase();
    if (!symbol) return;
    const list = [{ ...item, symbol }, ...getRecent(target).filter(row => row.symbol !== symbol)];
    target.setItem(RECENT_SEARCH_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch { /* A blocked/full browser store must not prevent opening a stock. */ }
}

export function removeRecent(symbol: string, storage?: StoragePort) {
  try {
    const target = storage ?? localStorage;
    target.setItem(RECENT_SEARCH_KEY, JSON.stringify(getRecent(target).filter(row => row.symbol !== symbol)));
  } catch { /* Browsing still works without persistence. */ }
}
