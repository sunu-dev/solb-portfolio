import { describe, expect, it } from 'vitest';
import { analyzeMarketFlow } from '@/utils/marketFlow';
import type { EnrichedStockData } from '@/utils/chokDataEnricher';

function quote(symbol: string, todayChangePct: number | null): EnrichedStockData {
  return {
    symbol,
    currentPrice: 100,
    peRatio: null,
    weekHigh52: null,
    weekLow52: null,
    week52Position: null,
    yearReturn: null,
    month1Return: null,
    todayChange: null,
    todayChangePct,
  };
}

describe('analyzeMarketFlow', () => {
  it('섹터 상대강도와 확산도가 함께 벌어질 때만 순환 신호를 만든다', () => {
    const result = analyzeMarketFlow([
      quote('SPY', -0.5), quote('QQQ', -1.5), quote('SOXX', -4),
      quote('NVDA', -4.2), quote('AMD', -3.4), quote('MU', -5.1),
      quote('KO', 2.8), quote('PG', 3.2), quote('MO', 2.4),
      quote('JPM', 0.1), quote('GS', -0.1),
    ], '2026-07-17T00:00:00.000Z');

    expect(result.rotation).toEqual(expect.objectContaining({ detected: true, confidence: 'high' }));
    expect(result.strongest?.sector).toBe('consumer_staples');
    expect(result.weakest?.sector).toBe('semiconductor');
    expect(result.summary).toContain('섹터 간 순환 신호');
    expect(result.evidence).toContain('반도체 ETF -4.0%');
  });

  it('몇 종목만 엇갈리거나 격차가 작으면 순환으로 단정하지 않는다', () => {
    const result = analyzeMarketFlow([
      quote('SPY', 0.1), quote('QQQ', 0.2),
      quote('NVDA', 0.4), quote('AMD', -0.2),
      quote('KO', 0.3), quote('PG', 0.1),
    ]);

    expect(result.rotation.detected).toBe(false);
    expect(result.rotation.confidence).toBe('low');
    expect(result.summary).toContain('단정할 정도는 아니에요');
  });

  it('표본 1개 섹터와 데이터 없는 종목은 섹터 판단에서 제외한다', () => {
    const result = analyzeMarketFlow([
      quote('SPY', -0.2), quote('VZ', 4), quote('XOM', null),
      quote('NVDA', -1), quote('AMD', -2),
    ]);

    expect(result.sectors.some(sector => sector.sector === 'communication')).toBe(false);
    expect(result.coverage).toEqual({ available: 4, total: 5, ratio: 0.8 });
  });

  it('섹터 이름의 받침에 맞는 주격 조사를 사용한다', () => {
    const result = analyzeMarketFlow([
      quote('SPY', -1),
      quote('NVDA', -4), quote('AMD', -3), quote('MU', -5),
      quote('O', 3), quote('AMT', 2), quote('PLD', 4),
    ]);

    expect(result.summary).toContain('반도체가 상대적으로 약하고 부동산이 강해');
  });
});
