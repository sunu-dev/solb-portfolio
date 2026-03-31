import { describe, it, expect } from 'vitest';
import { calcStockAttributes } from '@/utils/mentorScores';

describe('calcStockAttributes', () => {
  const baseInput = {
    symbol: 'AAPL',
    price: 175,
    change: 2.5,
    changePercent: 1.45,
  };

  it('개별 주식 기본 점수 (1~5 범위)', () => {
    const scores = calcStockAttributes(baseInput);
    for (const val of Object.values(scores)) {
      expect(val).toBeGreaterThanOrEqual(1);
      expect(val).toBeLessThanOrEqual(5);
    }
  });

  it('레버리지 ETF — 안전성 1점 고정', () => {
    const scores = calcStockAttributes({ ...baseInput, symbol: 'TQQQ' });
    expect(scores.safety).toBe(1);
    expect(scores.income).toBe(1);
  });

  it('인버스 ETF — 안전성 1점, 성장성 1점', () => {
    const scores = calcStockAttributes({ ...baseInput, symbol: 'SQQQ' });
    expect(scores.safety).toBe(1);
    expect(scores.growth).toBe(1);
  });

  it('인덱스 ETF — 안전성 높음', () => {
    const scores = calcStockAttributes({ ...baseInput, symbol: 'SPY' });
    expect(scores.safety).toBeGreaterThanOrEqual(4);
  });

  it('배당 ETF — 수익성 5점', () => {
    const scores = calcStockAttributes({ ...baseInput, symbol: 'SCHD' });
    expect(scores.income).toBe(5);
  });

  it('혁신 종목 — 성장성 높음', () => {
    const scores = calcStockAttributes({ ...baseInput, symbol: 'NVDA' });
    expect(scores.growth).toBeGreaterThanOrEqual(4);
  });

  it('RSI 과매도 — 가치 점수 높음', () => {
    const scores = calcStockAttributes({ ...baseInput, rsiVal: 25 });
    expect(scores.value).toBeGreaterThanOrEqual(4);
  });

  it('거래량 높으면 관심도 높음', () => {
    const scores = calcStockAttributes({ ...baseInput, volRatio: 2.5 });
    expect(scores.interest).toBeGreaterThanOrEqual(4);
  });
});
