import type { QuoteData } from '@/config/constants';
import { boundedFetch } from './boundedFetch';

interface QuoteBatch {
  quotes?: Record<string, QuoteData | null>;
  usdKrw?: { c: number; d: number | null; dp: number | null } | null;
}
const pending = new Map<string, Promise<QuoteBatch>>();

/** Share overlapping refreshes, never cache a failed response or renew old prices. */
export function loadQuoteBatch(symbols: string[], macro: boolean): Promise<QuoteBatch> {
  const unique = [...new Set(symbols)].sort();
  const key = JSON.stringify([unique, macro]);
  const existing = pending.get(key);
  if (existing) return existing;
  const work = boundedFetch('/api/quotes', 9000, response => response.json() as Promise<QuoteBatch>, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbols: unique, macro }),
  }).finally(() => { if (pending.get(key) === work) pending.delete(key); });
  pending.set(key, work);
  return work;
}
