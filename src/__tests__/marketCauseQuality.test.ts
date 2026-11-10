import { describe, it, expect } from 'vitest';
import { combineCompanyExplanations } from '@/lib/marketCause/companyStory';
import { auditExplanationQuality } from '@/lib/marketCause/qualityAudit';
import type { CompanyExplanation } from '@/lib/marketCause/companyTypes';
const base:CompanyExplanation={id:'revenue',symbol:'INTC',name:'인텔',kind:'financial_comparison',title:'매출',summary:'',meaning:'',path:'',condition:'',next:'',publishedAt:'2026-10-30T20:00:00Z',checkedAt:'2026-10-31T00:00:00Z',corrected:false,sources:[{label:'SEC',url:'https://www.sec.gov/Archives/edgar/data/50863/000005086326000100/index.html'}],comparison:{label:'매출',current:'120',previous:'100',currentPeriod:'2026-07-01~2026-09-30',previousPeriod:'2025-07-01~2025-09-30',unit:'USD'}};
const profit:CompanyExplanation={...base,id:'profit',comparison:{...base.comparison!,label:'순이익',current:'10',previous:'20'}};
describe('connected financial explanation',()=>{
 it('connects diverging revenue and profit without inventing the cause',()=>{
  const cards=combineCompanyExplanations([base,profit]);expect(cards).toHaveLength(1);expect(cards[0].kind).toBe('financial_story');
  expect(cards[0].title).toBe('인텔, 매출은 늘었지만 순이익은 줄었어요');expect(cards[0].comparisons).toHaveLength(2);
  expect(cards[0].path).toContain('공시 본문에서 확인');
 });
 it('keeps different quarters, fiscal definitions, currency and filings separate',()=>{
  for(const patch of [{comparison:{...profit.comparison!,currentPeriod:'2026-01-01~2026-09-30'}},{comparison:{...profit.comparison!,unit:'KRW'}},{sources:[{label:'Other filing',url:base.sources[0].url.replace('000100','000101')}]},{publishedAt:'2026-10-29T20:00:00Z'}])expect(combineCompanyExplanations([base,{...profit,...patch}])).toHaveLength(2);
  expect(combineCompanyExplanations([base,profit,{...profit,id:'ambiguous'}])).toHaveLength(3);
 });
 it('preserves loss and correction language rather than calling negative profit growth',()=>{
  const loss={...profit,title:'인텔, 전년 같은 기간보다 적자가 줄었어요',corrected:true,comparison:{...profit.comparison!,current:'-10',previous:'-20'}};
  const card=combineCompanyExplanations([base,loss])[0];expect(card.title).toBe('인텔, 매출은 늘었고 적자가 줄었어요');expect(card.corrected).toBe(true);
 });
});
it('audits empty coverage honestly without fabricating independent evaluations or a release',()=>{
 const result=auditExplanationQuality([],null,'2026-10-31T01:00:00Z');
 expect(result.report.companies).toHaveLength(8);expect(result.cases).toEqual([]);expect(result.revokeHash).toBeNull();
 expect(result.report.independentlyReviewed).toBe(0);expect(result.report.explanationQualityVerified).toBe(false);
 expect(result.report.companies.every(c=>c.narrative==='not_collected')).toBe(true);
});
