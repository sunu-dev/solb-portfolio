import { describe, expect, it } from 'vitest';
import {
  convertStockAmount,
  convertStockCostAmount,
  getStockIdentityKey,
  getYahooSymbolCandidates,
  getStockCurrency,
  isKoreanStockSymbol,
  summarizePortfolioCurrency,
} from '@/utils/stockCurrency';

describe('isKoreanStockSymbol', () => {
  it('거래소 접미사와 과거 가져오기의 6자리 코드를 한국 종목으로 판별한다', () => {
    expect(isKoreanStockSymbol('005930.KS')).toBe(true);
    expect(isKoreanStockSymbol('247540.KQ')).toBe(true);
    expect(isKoreanStockSymbol('005930')).toBe(true);
  });

  it('미국 티커는 달러 종목으로 판별한다', () => {
    expect(isKoreanStockSymbol('AAPL')).toBe(false);
    expect(isKoreanStockSymbol('BRK.B')).toBe(false);
  });
});

describe('getStockCurrency', () => {
  it('통화를 추론할 수 없는 심볼에는 가져오기에서 보존한 명시 통화를 사용한다', () => {
    expect(getStockCurrency('UNKNOWN', 'KRW')).toBe('KRW');
  });

  it('명백한 한국 종목은 과거 가져오기의 잘못된 USD 값보다 심볼 판정을 우선한다', () => {
    expect(getStockCurrency('005930', 'USD')).toBe('KRW');
    expect(getStockCurrency('005930.KS', 'USD')).toBe('KRW');
  });
});

describe('getYahooSymbolCandidates', () => {
  it('접미사 없는 한국 6자리 코드는 KOSPI와 KOSDAQ 후보를 순서대로 만든다', () => {
    expect(getYahooSymbolCandidates(' 005930 ')).toEqual([
      '005930.KS',
      '005930.KQ',
    ]);
  });

  it('이미 거래소 접미사가 있거나 미국 종목이면 정규화한 심볼만 조회한다', () => {
    expect(getYahooSymbolCandidates('247540.kq')).toEqual(['247540.KQ']);
    expect(getYahooSymbolCandidates(' aapl ')).toEqual(['AAPL']);
  });
});

describe('getStockIdentityKey', () => {
  it('같은 한국 종목의 bare/KS/KQ 표기를 하나의 가져오기 식별자로 묶는다', () => {
    expect(getStockIdentityKey('005930')).toBe('KR:005930');
    expect(getStockIdentityKey('005930.KS')).toBe('KR:005930');
    expect(getStockIdentityKey('005930.kq')).toBe('KR:005930');
  });

  it('미국 티커는 대문자 정규화 외에는 바꾸지 않는다', () => {
    expect(getStockIdentityKey(' brk.b ')).toBe('BRK.B');
  });
});

describe('convertStockCostAmount', () => {
  it('미국 종목 매입가는 실제 매수 환율을 우선한다', () => {
    expect(convertStockCostAmount('AAPL', 200, 1459.41, 1320)).toEqual({
      krw: 264_000,
      usd: 200,
    });
  });

  it('매수 환율이 없으면 현재 환율로 안전하게 대체한다', () => {
    expect(convertStockCostAmount('AAPL', 200, 1459.41)).toEqual({
      krw: 291_882,
      usd: 200,
    });
  });

  it('한국 종목 매입가에는 어떤 환율도 곱하지 않는다', () => {
    const amounts = convertStockCostAmount('005930.KS', 220_000, 1459.41, 1320);

    expect(amounts.krw).toBe(220_000);
    expect(amounts.usd).toBeCloseTo(150.75, 2);
  });
});

describe('summarizePortfolioCurrency', () => {
  it('한국·미국 혼합 보유액과 비중의 공통 분모를 정확히 계산한다', () => {
    const summary = summarizePortfolioCurrency([
      {
        symbol: '005930.KS',
        avgCost: 200_000,
        shares: 1,
        currentPrice: 220_000,
        dayChange: 5_000,
      },
      {
        symbol: 'AAPL',
        avgCost: 200,
        shares: 1,
        currentPrice: 220,
        dayChange: 2,
        purchaseRate: 1300,
      },
    ], 1459.41);

    expect(summary.totalValueKrw).toBeCloseTo(541_070.2, 1);
    expect(summary.totalCostKrw).toBe(460_000);
    expect(summary.totalPnlKrw).toBeCloseTo(81_070.2, 1);
    expect(summary.totalPnlPctKrw).toBeCloseTo(17.62, 2);
    expect(summary.todayChangeKrw).toBeCloseTo(7_918.82, 2);
    expect(summary.holdingCount).toBe(2);

    const koreanWeight = 220_000 / summary.totalValueKrw * 100;
    expect(koreanWeight).toBeCloseTo(40.66, 2);
  });

  it('KRW와 USD 기준 손익의 금액·부호·퍼센트를 각각 일관되게 계산한다', () => {
    const summary = summarizePortfolioCurrency([
      {
        symbol: 'AAPL',
        avgCost: 100,
        shares: 1,
        currentPrice: 99,
        purchaseRate: 1200,
      },
    ], 1459.41);

    expect(summary.totalPnlUsd).toBe(-1);
    expect(summary.totalPnlPctUsd).toBe(-1);
    expect(summary.totalPnlKrw).toBeCloseTo(24_481.59, 2);
    expect(summary.totalPnlPctKrw).toBeGreaterThan(0);
  });
});

describe('convertStockAmount', () => {
  const usdKrw = 1459.41;

  it('한국 현재가에는 환율을 다시 곱하지 않는다', () => {
    const amounts = convertStockAmount('005930.KS', 220_000, usdKrw);

    expect(amounts.krw).toBe(220_000);
    expect(amounts.usd).toBeCloseTo(150.75, 2);
  });

  it('미국 현재가만 원화로 환산한다', () => {
    const amounts = convertStockAmount('AAPL', 220, usdKrw);

    expect(amounts.krw).toBeCloseTo(321_070.2, 1);
    expect(amounts.usd).toBe(220);
  });

  it('잘못된 환율에서는 거짓 환산값을 만들지 않는다', () => {
    expect(convertStockAmount('005930.KS', 220_000, 0)).toEqual({
      krw: 220_000,
      usd: 0,
    });
    expect(convertStockAmount('AAPL', 220, Number.NaN)).toEqual({
      krw: 0,
      usd: 220,
    });
  });
});
