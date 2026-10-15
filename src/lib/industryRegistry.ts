import rawRegistry from '@/data/industry-registry.json';
import type { SectorId } from './sectorExploration';

export interface IndustryExample { symbol: string; name: string; products?: string; marketCap: number | null }
export interface IndustryGroup {
  id: string; name: string; raw: string; parent: SectorId; market: 'us' | 'kr'; count: number; examples: IndustryExample[];
}
export interface StoredIndustryProfile {
  symbol: string; name: string; industryId?: string; products?: string;
  status: 'classified' | 'missing-industry' | 'unmapped-industry' | 'conflict' | 'etp' | 'shell' | 'instrument' | 'not-covered';
  source?: 'us' | 'kr' | 'kis'; checkedAt: string; securityType?: 'preferred' | 'warrant' | 'unit' | 'debt'; issuerSymbol?: string;
  evidenceUrl?: string; evidenceCheckedAt?: string; listingNote?: string;
}
export const INDUSTRY_GROUPS = rawRegistry.industries as IndustryGroup[];
export const INDUSTRY_SOURCES = rawRegistry.sources;
export const INDUSTRY_CHECKED_AT = rawRegistry.checkedAt;
const groupsById = new Map(INDUSTRY_GROUPS.map(group => [group.id, group]));
export const industryGroup = (id?: string) => id ? groupsById.get(id) : undefined;
export const industrySource = (group: IndustryGroup) => INDUSTRY_SOURCES[group.market];

const providerParents = new Map(INDUSTRY_GROUPS.map(group => [group.raw.trim().toLowerCase(), group.parent]));
export const providerIndustryParent = (industry?: string | null) => providerParents.get(industry?.trim().toLowerCase() ?? '');
