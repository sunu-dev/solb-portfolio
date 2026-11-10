import { describe, expect, it } from 'vitest';
import { actionableImportIndices, reconcilePortfolioImport, applyPortfolioReconciliation } from '@/lib/portfolioReconciliation';
import { parsePortfolioImportCsv, reconcilePortfolioCsvImport, applyPortfolioCsvImport } from '@/utils/portfolioCsvImport';
import { isSingleStockLeverage, isUniverseEligibleClass, classifyAssetClass } from '@/utils/leverageGuard';
import type { PortfolioStocks } from '@/config/constants';
const empty: PortfolioStocks = { investing: [], watching: [], sold: [] };

describe('보유 기록과 신규 추천의 정책 분리', () => {
  it.each(['TSLL', 'NVDL', 'TQQQ', 'KORU', 'BRK.B', '005930'])('%s CSV 보유 기록은 등록·재등록·수정할 수 있다', symbol => {
    const parse = (shares: string) => parsePortfolioImportCsv(`종목코드,수량,평균단가,증권사\n${symbol},${shares},12.5,토스증권`);
    const rows = reconcilePortfolioCsvImport(parse('.068422').rows, empty, '');
    const selected = actionableImportIndices(rows);
    expect(selected.size).toBe(1);
    const first = applyPortfolioCsvImport(empty, rows, selected);
    expect(first.summary.added).toBe(1);
    expect(first.stocks.investing[0].shares).toBe(.068422);
    const unchanged = reconcilePortfolioCsvImport(parse('.068422').rows, first.stocks, '');
    expect(actionableImportIndices(unchanged).size).toBe(0);
    const changed = reconcilePortfolioCsvImport(parse('.2').rows, first.stocks, '');
    const updated = applyPortfolioCsvImport(first.stocks, changed, actionableImportIndices(changed));
    expect(updated.summary.updated).toBe(1);
    expect(updated.stocks.investing).toHaveLength(1);
    expect(updated.stocks.investing[0].shares).toBe(.2);
  });
  it('OCR로 읽은 TSLL도 같은 보유 기록 정책을 적용한다', () => {
    const drafts = [{ symbol:'TSLL', name:'Direxion Daily TSLA Bull 2X Shares', shares:.068422, avgCost:12.5, currency:'USD' as const }];
    const rows = reconcilePortfolioImport(drafts, empty, 'toss', 'investing');
    const result = applyPortfolioReconciliation(empty, rows, actionableImportIndices(rows), 'toss', 'investing');
    expect(result.stocks.investing[0]).toMatchObject({symbol:'TSLL',shares:.068422});
    expect(isSingleStockLeverage('TSLL')).toBe(true);
    expect(isUniverseEligibleClass(classifyAssetClass('TSLL'))).toBe(false);
  });
  it('증권사 미확인·중복·수량 미확인 행은 여전히 승인되지 않는다', () => {
    const drafts = [{ symbol:'TSLL', shares:null, avgCost:12.5, currency:'USD' as const }];
    expect(actionableImportIndices(reconcilePortfolioImport(drafts, empty, 'toss', 'investing')).size).toBe(0);
    expect(actionableImportIndices(reconcilePortfolioImport([{...drafts[0],shares:1}], empty, '', 'investing')).size).toBe(0);
    expect(actionableImportIndices(reconcilePortfolioImport([{...drafts[0],shares:1},{...drafts[0],shares:2}], empty, 'toss', 'investing')).size).toBe(0);
  });
});
