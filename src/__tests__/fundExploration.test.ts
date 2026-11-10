import { describe, expect, it } from 'vitest';
import { FUNDS, FUND_MECHANISMS, dailyTargetExample, fundProfile, fundQuestions, fundSummary, relatedFunds } from '@/lib/fundExploration';
import { detectLeverageProfile, isSingleStockLeverage } from '@/utils/leverageGuard';
import { fundAnalysisContext } from '@/lib/fundQuestionContext';

describe('ETF evidence and connected explanations',()=>{
  it('covers 302 distinct products with a mechanism, source and no broken reading links',()=>{
    expect(FUNDS).toHaveLength(302);
    expect(new Set(FUNDS.map(fund=>fund.symbol)).size).toBe(302);
    for(const fund of FUNDS) {
      expect(FUND_MECHANISMS[fund.kind]).toBeDefined();
      expect(fund.target.length).toBeGreaterThan(5);
      expect(new URL(fund.sourceUrl).protocol).toBe('https:');
      expect(new URL(fund.issuerUrl).protocol).toBe('https:');
      expect(Date.parse(fund.checkedAt)).not.toBeNaN();
      const questions=fundQuestions(fund);
      for(const question of Object.values(questions)) {
        expect(question.paragraphs.every(text=>text.trim().length>0)).toBe(true);
        expect(question.next).toHaveLength(3);
        expect(question.next).not.toContain(question.id);
        for(const next of question.next) expect(questions[next]).toBeDefined();
      }
      expect(relatedFunds(fund).length,fund.symbol).toBeGreaterThan(0);
      expect(relatedFunds(fund).every(other=>other.symbol!==fund.symbol)).toBe(true);
    }
  });
  it('does not invent ETF facts from a similar ticker or ordinary company',()=>{
    expect(fundProfile(' koru ')?.symbol).toBe('KORU');
    expect(fundProfile('KORUX')).toBeUndefined();
    expect(fundProfile('NVDA')).toBeUndefined();
    expect(fundProfile('005930.KS')).toBeUndefined();
  });
  it('uses a company share, rather than an index, throughout single-stock leverage context',()=>{
    for (const symbol of ['MUU', 'TSLL']) {
      const context = fundAnalysisContext(symbol);
      expect(context).toContain('수익 전달 과정: 기준 주식의 하루 주가 변화');
      expect(context).toContain(`${fundProfile(symbol)!.target}의 하루 주가 변화`);
      expect(context).not.toContain('기초지수는 이 상품이 수익률의 기준');
      expect(context).toContain('며칠간의 수익률은 기준 주식 수익률에 배수를 곱한 값과 달라질 수 있어요');
    }
    expect(fundAnalysisContext('SOXL')).toContain('수익 전달 과정: 기초지수의 하루 변화');
  });
  it('distinguishes Korean benchmark, semiconductor basket and interest-rate exposure',()=>{
    expect(fundQuestions(fundProfile('KORU')!).target.paragraphs.join(' ')).toContain('코스피 등락률에 바로 3을 곱하는 상품은 아니에요');
    expect(fundQuestions(fundProfile('SOXL')!).target.paragraphs.join(' ')).toContain('엔비디아 한 회사');
    expect(fundQuestions(fundProfile('TMF')!).target.paragraphs.join(' ')).toContain('금리 자체가 아니라');
    expect(fundProfile('QQQ')!.kind).not.toBe(fundProfile('QYLD')!.kind);
    expect(fundProfile('IBIT')!.kind).not.toBe(fundProfile('BITO')!.kind);
    expect(fundProfile('ETHA')!.kind).not.toBe(fundProfile('IBIT')!.kind);
    expect(fundProfile('FLOT')!.kind).not.toBe(fundProfile('USFR')!.kind);
    expect(fundProfile('BOXX')!.kind).not.toBe(fundProfile('SGOV')!.kind);
    expect(fundQuestions(fundProfile('BUFR')!).returns.paragraphs.join(' ')).toContain('원금 보장 상품이 아니에요');
    expect(fundProfile('GLD')!.kind).not.toBe(fundProfile('GDX')!.kind);
  });
  it('keeps index leverage guards consistent even with a missing or localized name',()=>{
    for(const fund of FUNDS.filter(fund=>fund.multiple)) for(const name of [undefined,'한국 ETF',fund.name]) {
      expect(detectLeverageProfile(fund.symbol,name)).toEqual({isLeverage:true,isSingle:!!fund.underlyingSymbol,isInverse:fund.multiple!<0,multiple:fund.multiple});
      expect(isSingleStockLeverage(fund.symbol,name)).toBe(!!fund.underlyingSymbol);
    }
    expect(isSingleStockLeverage('TSLL')).toBe(true);
    expect(fundSummary(fundProfile('SQQQ')!)).toContain('약 3% 내리도록');
  });
});

describe('daily target illustrations',()=>{
  it('shows that a round trip can lose value in both daily bullish and inverse products',()=>{
    const bull=dailyTargetExample([0.1,-1/11],3).at(-1)!;
    const bear=dailyTargetExample([0.1,-1/11],-3).at(-1)!;
    expect(bull.index).toBeCloseTo(100);
    expect(bull.product).toBeCloseTo(94.5454545);
    expect(bear.index).toBeCloseTo(100);
    expect(bear.product).toBeCloseTo(89.090909);
  });
  it('also shows compounding in a steady rise rather than asserting that leverage always decays',()=>{
    const result=dailyTargetExample([0.05,0.05],3).at(-1)!;
    expect(result.index).toBeCloseTo(110.25);
    expect(result.product).toBeCloseTo(132.25);
    expect(result.product-100).toBeGreaterThan((result.index-100)*3);
  });
  it('does not render negative portfolio values or non-finite scenario inputs',()=>{
    expect(()=>dailyTargetExample([-0.5],3)).toThrow();
    expect(()=>dailyTargetExample([NaN],3)).toThrow();
    expect(()=>dailyTargetExample([0.1],Infinity)).toThrow();
    expect(dailyTargetExample([],3)).toEqual([{day:0,index:100,product:100}]);
  });
});
