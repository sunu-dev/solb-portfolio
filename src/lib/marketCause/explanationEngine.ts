import type { MarketFlowBrief } from '../marketFlowEngine';
import type { CompanyExplanation } from './companyTypes';
export interface LinkedCompanyExplanation extends CompanyExplanation {
  timing: 'before_observation' | 'after_observation' | 'earlier_background';
}
/** A shared public report links by exact company and bounded time. This is
 * context, never a causal percentage or proof that the release moved the price. */
const priority = (card: CompanyExplanation) => card.kind === 'company_statement' ? -2 : card.kind === 'financial_story' ? -1 : ['순이익', '매출', '설비투자 지출', '영업활동 현금흐름'].indexOf(card.comparison?.label ?? '');
export function attachCompanyExplanations(briefs: MarketFlowBrief[], cards: CompanyExplanation[]): MarketFlowBrief[] {
  return briefs.map(brief => {
    const observed = Date.parse(brief.asOf);
    const linked: LinkedCompanyExplanation[] = [];
    for (const company of brief.companies) {
      const selected = cards.filter(card => brief.market === 'us' && card.symbol === company.symbol
        && Number.isFinite(Date.parse(card.publishedAt)) && Math.abs(Date.parse(card.publishedAt) - observed) <= 7 * 86400000)
        .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || priority(a) - priority(b) || a.id.localeCompare(b.id));
      for (const card of [...new Map(selected.map(c => [c.id, c])).values()].slice(0, 2)) {
        const delta = observed - Date.parse(card.publishedAt);
        linked.push({ ...card, timing: delta < 0 ? 'after_observation' : delta <= 48 * 3600000 ? 'before_observation' : 'earlier_background' });
      }
    }
    return { ...brief, companyExplanations: linked };
  });
}
