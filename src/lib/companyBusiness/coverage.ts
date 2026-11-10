import { businessMarket } from './market';
import type { SecListing, DartListing } from './sources';

export type MappingState = 'directory_match' | 'identity_conflict' | 'not_in_directory' | 'domestic_not_configured';
/** Directory coverage is a collection prerequisite, never a completed explanation count. */
export function auditBusinessMapping(input: {
  inventory: { symbol: string; priority: number; conflict?: boolean }[];
  sec: SecListing[]; dart?: DartListing[]; checkedAt: string;
}) {
  const index = (rows: (SecListing | DartListing)[]) => {
    const map = new Map<string, (SecListing | DartListing)[]>();
    for (const row of rows) map.set(row.symbol, [...(map.get(row.symbol) ?? []), row]);
    return map;
  };
  const us = index(input.sec), kr = input.dart ? index(input.dart) : null;
  const rows = input.inventory.map(row => {
    const market = businessMarket(row.symbol);
    const matches = (market === 'KR' ? kr : us)?.get(market === 'KR' ? row.symbol.replace(/\.(KS|KQ)$/, '') : row.symbol) ?? [];
    const state: MappingState = row.conflict || matches.length > 1 ? 'identity_conflict'
      : market === 'KR' && !kr ? 'domestic_not_configured' : matches.length === 1 ? 'directory_match' : 'not_in_directory';
    return { ...row, market, state, ...(state === 'directory_match' ? { issuerId: matches[0].issuerId } : {}) };
  });
  return { checkedAt: input.checkedAt, total: rows.length, stage: 'directory_only' as const,
    explanationReady: false,
    counts: Object.fromEntries(['directory_match','identity_conflict','not_in_directory','domestic_not_configured'].map(state => [state, rows.filter(r => r.state === state).length])),
    markets: { KR: rows.filter(r => r.market === 'KR').length, US: rows.filter(r => r.market === 'US').length }, rows };
}
