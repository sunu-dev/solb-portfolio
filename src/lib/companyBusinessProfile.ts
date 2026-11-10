import { companyStory } from './companyStories';
import { explorationCompany } from './contextExploration';
import { INDUSTRY_SOURCES, type StoredIndustryProfile } from './industryRegistry';
import { getStockIdentityKey } from '@/utils/stockCurrency';
import { euroRo } from '@/utils/koreanJosa';

export interface CompanyBusinessProfile {
  symbol: string;
  level: 'detailed' | 'summary' | 'products' | 'missing' | 'restricted';
  summary?: string;
  customers?: string; revenue?: string; watch?: string;
  origin?: 'engine'; sourcePublishedAt?: string; version?: string; validUntil?: string; availability?: 'loading' | 'rechecking' | 'unavailable';
  sources: { label: string; url: string; reviewedAt?: string }[];
}
/** Shared API, UI and coverage contract. Classification is not business coverage. */
export function companyBusinessProfile(symbol: string, profile?: StoredIndustryProfile, verified?: CompanyBusinessProfile): CompanyBusinessProfile {
  const matched = profile && getStockIdentityKey(profile.symbol) === getStockIdentityKey(symbol) ? profile : undefined;
  if (matched && ['etp', 'instrument', 'shell', 'conflict'].includes(matched.status)) return { symbol, level: 'restricted', sources: [] };
  if (verified?.origin === 'engine' && getStockIdentityKey(verified.symbol) === getStockIdentityKey(symbol)) {
    if (verified.level === 'detailed' && verified.summary && verified.customers && verified.revenue && verified.watch
      && verified.sources.length && verified.validUntil && Date.parse(verified.validUntil) > Date.now()) return verified;
    return { symbol, origin: 'engine', level: 'missing', sources: [], availability: verified.availability === 'unavailable' || verified.availability === 'loading' ? verified.availability : 'rechecking' };
  }
  const story = companyStory(symbol);
  if (story) return { symbol, level: 'detailed', summary: story.summary, customers: story.customers, revenue: story.revenue, watch: story.watch, sources: story.sources };
  const reviewed = explorationCompany(symbol);
  if (reviewed?.business) return { symbol, level: 'summary', summary: reviewed.business, sources: [reviewed.source] };
  if (matched?.products && matched.source === 'kr') return { symbol, level: 'products',
    summary: `거래소에는 주요 제품·사업이 ‘${matched.products}’${euroRo(matched.products)} 등록돼 있어요.`,
    sources: [{ label: '한국거래소 · 등록 제품 정보', url: INDUSTRY_SOURCES.kr.url, reviewedAt: matched.checkedAt.slice(0, 10) }] };
  return { symbol, level: 'missing', sources: [] };
}

export function companyDisplayName(symbol: string, candidates: (string | null | undefined)[]): string {
  return candidates.map(name => name?.trim()).find(name => name && getStockIdentityKey(name) !== getStockIdentityKey(symbol)) ?? symbol;
}
