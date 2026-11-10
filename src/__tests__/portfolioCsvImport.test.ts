import { describe, expect, it } from 'vitest';
import type { PortfolioStocks } from '@/config/constants';
import {
  applyPortfolioCsvImport,
  parsePortfolioImportCsv,
  reconcilePortfolioCsvImport,
} from '@/utils/portfolioCsvImport';
import { buildPortfolioCsv } from '@/utils/portfolioExport';

const EMPTY: PortfolioStocks = { investing: [], watching: [], sold: [] };

describe('포트폴리오 CSV 가져오기', () => {
  it('주비에서 내보낸 CSV의 따옴표·증권사·카테고리를 다시 읽는다', () => {
    const csv = buildPortfolioCsv({
      investing: [{
        symbol: 'AAPL',
        name: 'Apple, Inc.',
        avgCost: 190.5,
        shares: 2,
        targetReturn: 10,
        broker: 'toss',
      }],
      watching: [{
        symbol: '005930',
        name: '삼성전자',
        avgCost: 0,
        shares: 0,
        targetReturn: 0,
        broker: 'samsung',
      }],
      sold: [],
    });

    const result = parsePortfolioImportCsv(csv);

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      broker: 'toss',
      category: 'investing',
      draft: { symbol: 'AAPL', name: 'Apple, Inc.', avgCost: 190.5, shares: 2, currency: 'USD' },
    });
    expect(result.rows[1]).toMatchObject({
      broker: 'samsung',
      category: 'watching',
      draft: { symbol: '005930', currency: 'KRW' },
    });
  });

  it('정리 종목과 숫자가 잘못된 행을 안전하게 제외한다', () => {
    const csv = [
      '구분,종목코드,종목명,증권사,수량,평균단가',
      '정리,TSLA,테슬라,토스증권,1,200',
      '보유,NVDA,엔비디아,토스증권,두주,120',
      '보유,MSFT,마이크로소프트,토스증권,1,400',
    ].join('\n');

    const result = parsePortfolioImportCsv(csv);

    expect(result.rows.map((row) => row.draft.symbol)).toEqual(['MSFT']);
    expect(result.skippedSold).toBe(1);
    expect(result.issues).toHaveLength(2);
  });

  it('증권사가 없는 행은 선택 전까지 기존 기록을 변경 대상으로 만들지 않는다', () => {
    const parsed = parsePortfolioImportCsv([
      '종목코드,종목명,수량,평균단가',
      'AAPL,애플,3,120',
    ].join('\n'));

    expect(reconcilePortfolioCsvImport(parsed.rows, EMPTY, '')[0].reason).toBe('broker_required');
    expect(reconcilePortfolioCsvImport(parsed.rows, EMPTY, 'kiwoom')[0].status).toBe('new');
  });

  it('서로 다른 증권사의 종목을 한 파일에서 각각 추가한다', () => {
    const parsed = parsePortfolioImportCsv([
      '구분,종목코드,종목명,증권사,수량,평균단가',
      '보유,AAPL,애플,토스증권,2,100',
      '보유,AAPL,애플,키움증권,1,120',
    ].join('\n'));
    const rows = reconcilePortfolioCsvImport(parsed.rows, EMPTY, '');
    const applied = applyPortfolioCsvImport(EMPTY, rows, new Set([0, 1]));

    expect(applied.summary).toMatchObject({ added: 2, updated: 0 });
    expect(applied.stocks.investing.map((stock) => stock.broker)).toEqual(['toss', 'kiwoom']);
  });

  it('같은 증권사·종목이 다른 구분으로 중복돼도 자동 반영하지 않는다', () => {
    const parsed = parsePortfolioImportCsv([
      '구분,종목코드,종목명,증권사,수량,평균단가',
      '보유,AAPL,애플,토스증권,2,100',
      '관심,AAPL,애플,토스증권,0,0',
    ].join('\n'));
    const rows = reconcilePortfolioCsvImport(parsed.rows, EMPTY, '');

    expect(rows.every((row) => row.reason === 'duplicate_in_upload')).toBe(true);
    expect(applyPortfolioCsvImport(EMPTY, rows, new Set([0, 1])).summary.added).toBe(0);
  });

  it('기존값과 달라진 필드만 갱신하고 원본은 바꾸지 않는다', () => {
    const stocks: PortfolioStocks = {
      ...EMPTY,
      investing: [{
        symbol: 'NVDA',
        avgCost: 100,
        shares: 2,
        targetReturn: 20,
        broker: 'toss',
      }],
    };
    const parsed = parsePortfolioImportCsv([
      '구분,종목코드,종목명,증권사,수량,평균단가',
      '보유,NVDA,엔비디아,토스증권,3,110',
    ].join('\n'));
    const rows = reconcilePortfolioCsvImport(parsed.rows, stocks, '');
    const applied = applyPortfolioCsvImport(stocks, rows, new Set([0]));

    expect(applied.summary).toMatchObject({ added: 0, updated: 1 });
    expect(applied.stocks.investing[0]).toMatchObject({ shares: 3, avgCost: 110, targetReturn: 20 });
    expect(stocks.investing[0]).toMatchObject({ shares: 2, avgCost: 100 });
  });

  it('필수 열과 닫히지 않은 따옴표를 거부한다', () => {
    expect(() => parsePortfolioImportCsv('종목코드,종목명\nAAPL,애플')).toThrow('종목코드, 수량, 평균단가');
    expect(() => parsePortfolioImportCsv('종목코드,수량,평균단가\n"AAPL,1,100')).toThrow('따옴표');
  });
  it('한국 코드의 거래소 접미사가 달라도 같은 증권사·종목 중복을 미리 막는다', () => {
    const parsed = parsePortfolioImportCsv('구분,종목코드,수량,평균단가,증권사\n보유,005930,2,70000,토스증권\n관심,005930.KS,0,0,토스증권');
    const rows = reconcilePortfolioCsvImport(parsed.rows, EMPTY, '');
    expect(rows.every(row => row.reason === 'duplicate_in_upload')).toBe(true);
    expect(applyPortfolioCsvImport(EMPTY, rows, new Set([0, 1])).stocks).toEqual(EMPTY);
  });
  it('샘플을 제거해 배열 위치가 바뀌어도 다른 실제 종목을 수정하지 않는다', () => {
    const stocks: PortfolioStocks = { ...EMPTY, investing: [
      { symbol: 'SAMPLE', shares: 1, avgCost: 1, targetReturn: 10, demo: true },
      { symbol: 'AAPL', shares: 2, avgCost: 100, targetReturn: 10, broker: 'toss' },
      { symbol: 'MSFT', shares: 3, avgCost: 300, targetReturn: 10, broker: 'toss' },
    ] };
    const parsed = parsePortfolioImportCsv('종목코드,수량,평균단가,증권사\nAAPL,5,110,토스증권');
    const rows = reconcilePortfolioCsvImport(parsed.rows, stocks, '');
    const result = applyPortfolioCsvImport(stocks, rows, new Set([0]));
    expect(result.stocks.investing).toMatchObject([
      { symbol: 'AAPL', shares: 5, avgCost: 110 },
      { symbol: 'MSFT', shares: 3, avgCost: 300 },
    ]);
    expect(result.summary.updated).toBe(1);
    expect(stocks.investing[1].shares).toBe(2);
  });
  it('미리보기 이후 바뀐 현재 기록을 덮어쓰거나 같은 신규 종목을 중복 추가하지 않는다', () => {
    const parsed = parsePortfolioImportCsv('종목코드,수량,평균단가,증권사\nAAPL,5,110,토스증권');
    const before: PortfolioStocks = { ...EMPTY, investing: [{ symbol: 'AAPL', shares: 2, avgCost: 100, targetReturn: 10, broker: 'toss' }] };
    const changed: PortfolioStocks = { ...EMPTY, investing: [{ ...before.investing[0], shares: 7 }] };
    const rows = reconcilePortfolioCsvImport(parsed.rows, before, '');
    expect(applyPortfolioCsvImport(changed, rows, new Set([0]))).toMatchObject({ stocks: changed, summary: { updated: 0, needsReview: 1 } });
    const freshRows = reconcilePortfolioCsvImport(parsed.rows, EMPTY, '');
    expect(applyPortfolioCsvImport(changed, freshRows, new Set([0]))).toMatchObject({ stocks: changed, summary: { added: 0, needsReview: 1 } });
  });
});
