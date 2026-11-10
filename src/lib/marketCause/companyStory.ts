import { canonicalDigest, compareDecimal } from './normalizeFacts';
import type { CompanyExplanation } from './companyTypes';
/** Combine only exact matching fiscal windows from the same filing. Growing
 * revenue alongside falling profit is context, not proof of any specific cause. */
export function combineCompanyExplanations(cards: CompanyExplanation[]): CompanyExplanation[] {
  const consumed = new Set<string>(), stories: CompanyExplanation[] = [];
  for (const revenue of cards.filter(c => c.comparison?.label === '매출' && c.kind === 'financial_comparison')) {
    const r = revenue.comparison!;
    const profits = cards.filter(c => c.symbol === revenue.symbol && c.kind === 'financial_comparison' && c.comparison?.label === '순이익'
      && c.publishedAt === revenue.publishedAt && c.comparison.currentPeriod === r.currentPeriod && c.comparison.previousPeriod === r.previousPeriod
      && c.comparison.unit === r.unit && c.sources.some(s => s.url.includes('/Archives/edgar/') && revenue.sources.some(t => t.url === s.url)));
    if (profits.length !== 1 || consumed.has(profits[0].id)) continue;
    const profit = profits[0], p = profit.comparison!;
    const rd = compareDecimal(r.current, r.previous), pd = compareDecimal(p.current, p.previous);
    if (!rd || !pd) continue;
    const negative = compareDecimal(p.current, '0') < 0 || compareDecimal(p.previous, '0') < 0;
    let profitPhrase = `순이익은 ${pd > 0 ? '늘었어요' : '줄었어요'}`;
    if (negative) profitPhrase = profit.title.split('전년 같은 기간보다 ')[1] ?? profitPhrase;
    const contrast = rd !== pd;
    const title = !negative && !contrast ? `${revenue.name}, 매출과 순이익이 함께 ${rd > 0 ? '늘었어요' : '줄었어요'}`
      : `${revenue.name}, 매출은 ${rd > 0 ? '늘었' : '줄었'}${contrast ? '지만' : '고'} ${profitPhrase}`;
    stories.push({ ...revenue, id: canonicalDigest(['company-story-v1', revenue.id, profit.id]), kind: 'financial_story', title,
      summary: `${r.currentPeriod} 실적을 전년의 대응 기간과 비교한 결과예요. 매출과 이익을 함께 보면 회사의 상황을 더 잘 이해할 수 있어요.`,
      meaning: '매출은 상품·서비스를 팔아 벌어들인 금액이고, 순이익은 비용과 세금 등을 반영하고 남은 이익이에요.',
      path: contrast ? '매출과 이익의 방향이 다를 때는 비용·세금·일회성 항목을 함께 봐야 해요. 비용 증가 때문인지 다른 이유 때문인지는 공시 본문에서 확인해야 해요.'
        : '매출과 이익의 변화가 같은 방향이어도 다음 실적이 같을 것이라는 뜻은 아니에요. 사업에서 실제로 들어오는 현금과 다음 전망도 함께 봐야 해요.',
      next: '영업이익과 일회성 항목, 회사가 밝힌 다음 실적 전망을 이어서 확인해요.',
      checkedAt: revenue.checkedAt < profit.checkedAt ? revenue.checkedAt : profit.checkedAt, corrected: revenue.corrected || profit.corrected,
      sources: [...new Map([...revenue.sources, ...profit.sources].map(s => [s.url, s])).values()], comparison: undefined, comparisons: [r, p] });
    consumed.add(revenue.id); consumed.add(profit.id);
  }
  return [...stories, ...cards.filter(c => !consumed.has(c.id))];
}
