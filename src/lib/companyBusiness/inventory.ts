import catalog from '../../../public/stock-catalog.json';
import registry from '@/data/industry-registry.json';
import { getStoredIndustry } from '../storedIndustry';
import { getStockIdentityKey } from '@/utils/stockCurrency';
/** All corporate candidates remain in the denominator, including unresolved identities. */
export function businessInventory(): { symbol: string; priority: number }[] {
  const surfaced = new Set(registry.industries.flatMap(g => g.examples.map(e => getStockIdentityKey(e.symbol))));
  const rows = catalog.stocks.filter(s => !['etp', 'shell', 'instrument'].includes(getStoredIndustry(s.symbol).status))
    .map(s => ({ symbol: s.symbol, priority: surfaced.has(getStockIdentityKey(s.symbol)) ? 0 : 1 }));
  if (new Set(rows.map(r => getStockIdentityKey(r.symbol))).size !== rows.length) throw new Error('duplicate_business_identity');
  return rows.sort((a, b) => a.priority - b.priority || a.symbol.localeCompare(b.symbol));
}
