import { companyBusinessProfile, type CompanyBusinessProfile } from '../companyBusinessProfile';
import type { StoredIndustryProfile } from '../industryRegistry';
import type { PublishedBusiness } from './store';
import { getStockIdentityKey } from '@/utils/stockCurrency';

/** The page and AI answers must honor the same publication/withdrawal decision. */
export function deliveredCompanyBusiness(symbol: string, classification: StoredIndustryProfile, published: PublishedBusiness): CompanyBusinessProfile {
  const basic = companyBusinessProfile(symbol, classification);
  if (basic.level === 'restricted') return basic;
  if (published.status === 'published') {
    const p = published.profile;
    if (getStockIdentityKey(p.symbol) !== getStockIdentityKey(symbol)) return { symbol, origin: 'engine', level: 'missing', sources: [], availability: 'rechecking' };
    return companyBusinessProfile(symbol, classification, { symbol: p.symbol, level: 'detailed', origin: 'engine', version: p.version,
      validUntil: p.validUntil, sourcePublishedAt: p.sourcePublishedAt, summary: p.summary, customers: p.customers,
      revenue: p.revenue, watch: p.watch, sources: p.sources });
  }
  if (published.status === 'withheld' || published.status === 'unavailable') return { symbol, level: 'missing', origin: 'engine', sources: [],
    availability: published.status === 'withheld' ? 'rechecking' : 'unavailable' };
  return basic;
}
