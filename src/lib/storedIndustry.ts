/** Server-side only: the full symbol lookup must never enter the browser bundle. */
import snapshot from '@/data/industry-catalog.json';
import { industryGroup, type StoredIndustryProfile } from './industryRegistry';
import { sectorById } from './sectorExploration';

type Row = Omit<StoredIndustryProfile, 'symbol' | 'checkedAt'>;
const records = snapshot.records as Record<string, Row>;
export function getStoredIndustry(symbol: string): StoredIndustryProfile {
  const normalized = symbol.trim().toUpperCase();
  const exact = records[normalized];
  if (exact) return { ...exact, symbol: normalized, checkedAt: snapshot.checkedAt };
  // A bare Korean code only inherits a record when its market match is unambiguous.
  if (/^[0-9A-Z]{6}$/.test(normalized) && /\d/.test(normalized)) {
    const matches = [normalized + '.KS', normalized + '.KQ'].filter(key => records[key]);
    if (matches.length === 1) return { ...records[matches[0]], symbol: matches[0], checkedAt: snapshot.checkedAt };
  }
  return { symbol: normalized, name: normalized, status: 'not-covered', checkedAt: snapshot.checkedAt };
}
export function storedIndustryFields(symbol: string) {
  const classification = getStoredIndustry(symbol);
  const group = industryGroup(classification.industryId);
  const classified = classification.status === 'classified' ? group : undefined;
  return { classification, sector: classified ? sectorById(classified.parent).name : null, industry: classified?.raw ?? null };
}
