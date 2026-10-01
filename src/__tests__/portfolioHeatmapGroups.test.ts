import { describe, expect, it } from 'vitest';
import { getPortfolioHeatmapGroup, getPortfolioHeatmapLabel } from '@/utils/portfolioHeatmapGroups';

describe('portfolio heatmap groups', () => {
  it.each([
    ['TSLL', '단일종목 레버리지'],
    ['MUU', '단일종목 레버리지'],
    ['KORU', '지수 레버리지'],
    ['TQQQ', '지수 레버리지'],
    ['NVDD', '단일종목 인버스'],
    ['SQQQ', '지수 인버스'],
    ['520100.KS', '단일종목 레버리지'],
    ['SPY', 'ETF'],
    ['TLT', '채권 ETF'],
  ])('keeps %s in its verified fund product group', (symbol, industry) => {
    expect(getPortfolioHeatmapGroup(symbol)).toEqual({ sector: 'ETF·ETN', industry });
  });

  it.each([
    ['AAPL', 'IT'],
    ['AMZN', '소비재'],
    ['TSLA', '자동차'],
    ['MU', 'IT'],
    ['005930.KS', 'IT'],
    ['005930', 'IT'],
    ['058470', 'IT'],
  ])('uses the existing sector for %s without inventing an industry', (symbol, sector) => {
    expect(getPortfolioHeatmapGroup(symbol)).toEqual({ sector, industry: '' });
  });

  it('normalizes the symbol before looking up verified fund names', () => {
    expect(getPortfolioHeatmapGroup(' muu ')).toEqual({ sector: 'ETF·ETN', industry: '단일종목 레버리지' });
  });

  it.each([
    ['069500.KS', 'ETF'],
    ['069500', 'ETF'],
    ['069660.KS', 'ETF'],
    ['102110.KS', 'ETF'],
    ['229200.KS', 'ETF'],
    ['133690.KS', 'ETF'],
    ['360750.KS', 'ETF'],
    ['379800.KS', 'ETF'],
    ['396500.KS', 'ETF'],
    ['453850.KS', 'ETF'],
    ['122630.KS', '레버리지'],
    ['114800.KS', '인버스'],
    ['252670.KS', '인버스'],
    ['252670', '인버스'],
  ])('recognizes verified Korean ETF %s without guessing its underlying', (symbol, industry) => {
    expect(getPortfolioHeatmapGroup(symbol)).toEqual({ sector: 'ETF·ETN', industry });
  });

  it.each([
    ['069500.KS', '069500.KS', 'KODEX 200'],
    ['069500', '069500', 'KODEX 200'],
    [' 133690.ks ', '133690', 'TIGER 미국나스닥100'],
    ['252670.KS', '252670.KS', 'KODEX 200선물인버스2X'],
    ['005930.KS', '삼성전자', '삼성전자'],
    ['005930', '005930', '삼성전자'],
    ['TSLL', 'TSLL', 'TSLL'],
    ['UNKNOWN', '저장된 이름', '저장된 이름'],
  ])('uses a verified Korean fund label or preserves the fallback for %s', (symbol, fallback, label) => {
    expect(getPortfolioHeatmapLabel(symbol, fallback)).toBe(label);
  });

  it('keeps a saved name for a Korean stock outside the static name map', () => {
    expect(getPortfolioHeatmapLabel('999999.KQ', '999999.KQ', '  저장된 신규 종목명  ')).toBe('저장된 신규 종목명');
  });

  it('keeps the registered Korean name for a bare numeric ticker', () => {
    expect(getPortfolioHeatmapLabel('036540', '036540', 'SFA반도체')).toBe('SFA반도체');
  });

  it('prefers the verified ETF name over a saved name', () => {
    expect(getPortfolioHeatmapLabel('069500', '069500', '예전 이름')).toBe('KODEX 200');
  });

  it('prefers a nonempty saved name over the static name map', () => {
    expect(getPortfolioHeatmapLabel('005930', '005930', '등록한 종목명')).toBe('등록한 종목명');
  });

  it('ignores whitespace-only saved names', () => {
    expect(getPortfolioHeatmapLabel('005930', '005930', '  ')).toBe('삼성전자');
    expect(getPortfolioHeatmapLabel('UNKNOWN', '기존 이름', '  ')).toBe('기존 이름');
  });

  it.each(['UNKNOWN', '999999.KQ', '999999', ''])('leaves %s unclassified when there is no evidence', symbol => {
    expect(getPortfolioHeatmapGroup(symbol)).toEqual({ sector: '미분류', industry: '' });
  });
});
