import { describe,it,expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import FinancialText from '@/components/common/FinancialText';
import { FINANCIAL_TERMS,financialTerm,financialTermMatches } from '@/lib/financialTerms';
import FundExploration from '@/components/explore/FundExploration';
import { fundProfile } from '@/lib/fundExploration';
describe('beginner definitions at the point of confusion',()=>{
  it('distinguishes the exchange, its semiconductor index, the benchmark and the ETF',()=>{
    const found=financialTermMatches('NYSE 반도체지수를 따르는 ETF의 기초지수와 NYSE는 무슨 뜻인가요?');
    expect(found.map(x=>x.id)).toEqual(['nyse-semiconductor','etf','benchmark','nyse']);
    expect(financialTerm('etf')?.meaning).toContain('거래소에서 사고팔');
    expect(financialTerm('nyse-semiconductor')?.meaning).toContain('30곳');
  });
  it('does not mistake part of a ticker or longer English word for an acronym',()=>{
    expect(financialTermMatches('ETFX라는 종목과 ABCNYSE라는 이름')).toEqual([]);
  });
  it('uses the shared beginner currency definition consistently instead of a company-specific cash-flow lesson',()=>{
    expect(financialTermMatches('환율이 내려가면 달러당 원화 환율도 확인해요.').map(x=>x.id)).toEqual(['fx']);
    expect(financialTermMatches('환율은 서로 다른 돈을 바꾸는 비율이에요.','fx')).toEqual([]);
    expect(financialTerm('fx')?.meaning).toContain('1달러');
  });
  it('renders semantic, keyboard-operable definition buttons without opening a dialog on page load',()=>{
    const html=renderToStaticMarkup(<FinancialText>ETF와 기초지수의 뜻</FinancialText>);
    expect(html).toContain('aria-label="ETF 뜻 보기"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('data-financial-term="benchmark"');
    expect(html).not.toContain('<dialog');
  });
  it('links SOXL prose and answer headings, while keeping question buttons free of nested buttons',()=>{
    const html=renderToStaticMarkup(<FundExploration symbol="SOXL" fund={fundProfile('SOXL')} />);
    expect(html).toContain('data-financial-term="etf"');
    expect(html).not.toMatch(/<button[^>]*data-fund-question[^>]*>(?:(?!<\/button>)[\s\S])*<button/);
    const answer=renderToStaticMarkup(<FundExploration symbol="SOXL" fund={fundProfile('SOXL')} embedded initialQuestion="target" />);
    expect(answer).toContain('data-financial-term="nyse-semiconductor"');
  });
  it('keeps every definition sourced and every related concept reachable',()=>{
    expect(new Set(FINANCIAL_TERMS.map(t=>t.id)).size).toBe(FINANCIAL_TERMS.length);
    for(const term of FINANCIAL_TERMS) {
      expect(new URL(term.source).protocol,term.id).toBe('https:');
      expect(term.meaning.length,term.id).toBeGreaterThan(25);
      for(const id of term.related??[])expect(financialTerm(id),`${term.id} → ${id}`).toBeDefined();
    }
  });
});
