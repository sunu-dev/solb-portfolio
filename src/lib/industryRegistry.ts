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

// Reuse a specific scene only where the source label actually matches its subject.
const illustrationScenes: Record<string, SectorId> = {
  Semiconductors: 'semiconductors', '반도체 제조업': 'semiconductors',
  'Semiconductor Equipment & Materials': 'equipment',
  'Drug Manufacturers - General': 'pharma', 'Drug Manufacturers - Specialty & Generic': 'pharma',
  Biotechnology: 'pharma', '의약품 제조업': 'pharma', '기초 의약물질 제조업': 'pharma',
  'Auto Manufacturers': 'automotive', '자동차용 엔진 및 자동차 제조업': 'automotive',
  'Aerospace & Defense': 'aerospace', '항공기,우주선 및 부품 제조업': 'aerospace',
  '선박 및 보트 건조업': 'shipbuilding', '일차전지 및 이차전지 제조업': 'batteries',
};
export const industryIllustration = (group: IndustryGroup): SectorId => illustrationScenes[group.raw] ?? group.parent;
