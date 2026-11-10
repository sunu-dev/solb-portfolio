import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { FUNDS, fundProfile, fundSummary, fundNextQuestions, type FundQuestionId } from '@/lib/fundExploration';
import { fundExplorationEntry } from '@/lib/fundExplorationEntry';
import FundExploration from '@/components/explore/FundExploration';
import StockCompanyOverview from '@/components/analysis/StockCompanyOverview';

describe('short introductions leading to the right asset', () => {
  it('gives all catalogued funds a concise, sourced exploration entry without inventing a stock industry', () => {
    const rows = [];
    for (const fund of FUNDS) {
      const entry = fundExplorationEntry(fund);
      expect(entry.label.length, fund.symbol).toBeLessThan(40);
      expect(entry.meaning.length, fund.symbol).toBeGreaterThan(25);
      const html = renderToStaticMarkup(<FundExploration symbol={fund.symbol} fund={fund} />);
      expect(html, fund.symbol).toContain('data-explanation-entry');
      expect(html, fund.symbol).toContain(fund.issuerUrl.replaceAll('&', '&amp;'));
      if (fund.multiple) expect(html, fund.symbol).toContain('data-explanation-daily');
      rows.push({symbol:fund.symbol,kind:fund.kind,summary:fundSummary(fund),entry,issuerUrl:fund.issuerUrl,
        checkedAt:fund.checkedAt,multiple:fund.multiple ?? null,htmlHash:createHash('sha256').update(html).digest('hex')});
    }
    if (process.env.JOOBI_EXPLORATION_AUDIT_DIR) {
      const dir=path.resolve(process.env.JOOBI_EXPLORATION_AUDIT_DIR);mkdirSync(dir,{recursive:true});
      writeFileSync(path.join(dir,'catalog-audit.json'),JSON.stringify({method:'static-render',count:rows.length,
        industryLinks:rows.filter(row=>row.entry.sector).length,browserNavigationVerified:false,rows},null,2));
    }
  });
  it('connects semiconductor funds to the industry but distinguishes examples from current holdings', () => {
    const entry = fundExplorationEntry(fundProfile('SOXL')!);
    expect(entry.sector).toBe('semiconductors');
    expect(entry.scope).toContain('현재 구성 종목이나 비중 목록은 아니에요');
    const html = renderToStaticMarkup(<FundExploration symbol="SOXL" fund={fundProfile('SOXL')} initialReading={{trail:[],targetOpen:true}} />);
    expect(html).toContain(entry.scope);
    expect(html.replace(/<[^>]*>/g,'')).toContain('하루에 1% 오르면 SOXL은 약 3% 오르도록');
  });
  it.each(['SGOV','GLD','IBIT','JEPI','TMF','TSLL','KORU'])('keeps %s tied to its own target instead of guessing an equity sector', symbol => {
    expect(fundExplorationEntry(fundProfile(symbol)!).sector).toBeUndefined();
  });
  it('preserves an open target reader when returning from another company', () => {
    const html = renderToStaticMarkup(<FundExploration symbol="SOXL" fund={fundProfile('SOXL')} initialReading={{trail:[],scenario:'rise',targetOpen:true}} />);
    expect(html).toMatch(/<details[^>]*data-explanation-entry[^>]*open/);
    expect(html).toContain('data-exploration-content');
  });
  it('continues to unread answers for every product and ends without a forced loop', () => {
    for(const fund of FUNDS) {
      const visited:FundQuestionId[]=[];
      for(let step=0;step<7;step++) {
        const choices=fundNextQuestions(fund,visited.at(-1),visited);
        expect(choices.some(id=>visited.includes(id)),fund.symbol).toBe(false);
        expect(choices.length,fund.symbol).toBe(7-step);
        visited.push(choices[0]);
      }
      expect(fundNextQuestions(fund,visited.at(-1),visited),fund.symbol).toEqual([]);
    }
  });
  it('provides an industry entry for known and unknown companies without fabricating business facts', () => {
    expect(renderToStaticMarkup(<StockCompanyOverview symbol="MSFT" name="마이크로소프트" />)).toContain('data-explanation-entry');
    const html = renderToStaticMarkup(<StockCompanyOverview symbol="UNKNOWN" name="미확인" />);
    expect(html).toContain('산업 둘러보기');
    expect(html).toContain('이 회사의 사업 소개는 주비에 아직 준비되지 않았어요');
  });
});
