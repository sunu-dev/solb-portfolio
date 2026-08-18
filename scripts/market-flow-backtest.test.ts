import { expect, test } from 'vitest';
import { CHOK_UNIVERSE } from '../src/config/chokUniverse';
import type { EnrichedStockData } from '../src/utils/chokDataEnricher';
import { analyzeMarketFlow } from '../src/utils/marketFlow';

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: { quote?: Array<{ close?: Array<number | null> }> };
    }>;
    error?: { description?: string } | null;
  };
}

const DEFAULT_DATES = [
  '2024-07-11', // 대형 기술주 약세와 비기술주 강세가 두드러졌던 날
  '2025-01-27', // DeepSeek 충격으로 반도체가 크게 흔들린 날
  '2025-04-09', // 관세 유예 발표 뒤 시장 전반이 급반등한 날
  '2025-08-01', // 성장 우려가 커지며 시장 전반이 약했던 날
  '2026-07-07', // 최근 데이터에서 탐지 안정성을 확인할 비교일
];

const EXPECTED_REGIMES: Record<string, {
  detected: boolean;
  strongest: string;
  weakest: string;
}> = {
  '2024-07-11': { detected: true, strongest: '부동산', weakest: '반도체' },
  '2025-01-27': { detected: true, strongest: '필수소비재', weakest: '반도체' },
  '2025-04-09': { detected: false, strongest: '반도체', weakest: '필수소비재' },
  '2025-08-01': { detected: true, strongest: '헬스케어', weakest: '빅테크' },
  '2026-07-07': { detected: true, strongest: '에너지', weakest: '반도체' },
};

function utcSeconds(date: string, dayOffset: number): number {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + dayOffset);
  return Math.floor(value.getTime() / 1000);
}

function dateKey(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

async function fetchDailyReturns(symbol: string, dates: string[]): Promise<Map<string, number>> {
  const first = [...dates].sort()[0];
  const last = [...dates].sort().at(-1)!;
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`);
  url.searchParams.set('period1', String(utcSeconds(first, -10)));
  url.searchParams.set('period2', String(utcSeconds(last, 3)));
  url.searchParams.set('interval', '1d');
  url.searchParams.set('events', 'history');

  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JoobiMarketFlowBacktest/1.0)' },
  });
  if (!response.ok) throw new Error(`${symbol}: Yahoo HTTP ${response.status}`);

  const payload = await response.json() as YahooChartResponse;
  const result = payload.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const returns = new Map<string, number>();

  for (let index = 1; index < timestamps.length; index += 1) {
    const previous = closes[index - 1];
    const current = closes[index];
    if (previous == null || current == null || previous <= 0) continue;
    returns.set(dateKey(timestamps[index]), ((current / previous) - 1) * 100);
  }
  return returns;
}

function quote(symbol: string, change: number | null): EnrichedStockData {
  return {
    symbol,
    currentPrice: null,
    peRatio: null,
    weekHigh52: null,
    weekLow52: null,
    week52Position: null,
    yearReturn: null,
    month1Return: null,
    todayChange: null,
    todayChangePct: change,
  };
}

test.skipIf(process.env.MARKET_FLOW_BACKTEST !== '1')(
  '실제 과거 종가로 시장 흐름 알고리즘을 재현한다',
  async () => {
    const dates = process.env.MARKET_FLOW_DATES?.split(',').filter(Boolean) ?? DEFAULT_DATES;
    const history = new Map<string, Map<string, number>>();

    for (let offset = 0; offset < CHOK_UNIVERSE.length; offset += 8) {
      const batch = CHOK_UNIVERSE.slice(offset, offset + 8);
      const rows = await Promise.all(batch.map(async ({ symbol }) => [
        symbol,
        await fetchDailyReturns(symbol, dates),
      ] as const));
      rows.forEach(([symbol, returns]) => history.set(symbol, returns));
    }

    const report = dates.map(date => {
      const quotes = CHOK_UNIVERSE.map(({ symbol }) => quote(symbol, history.get(symbol)?.get(date) ?? null));
      const result = analyzeMarketFlow(quotes, `${date}T21:00:00.000Z`);
      return {
        date,
        coverage: `${result.coverage.available}/${result.coverage.total}`,
        benchmarks: result.benchmarks,
        detected: result.rotation.detected,
        confidence: result.rotation.confidence,
        spreadPct: result.rotation.spreadPct,
        strongest: result.strongest && {
          sector: result.strongest.label,
          median: result.strongest.medianChangePct,
          breadth: result.strongest.advanceRatio,
          sample: result.strongest.sampleSize,
        },
        weakest: result.weakest && {
          sector: result.weakest.label,
          median: result.weakest.medianChangePct,
          breadth: result.weakest.advanceRatio,
          sample: result.weakest.sampleSize,
        },
        summary: result.summary,
      };
    });

    console.log(`\nMARKET_FLOW_BACKTEST\n${JSON.stringify(report, null, 2)}`);
    expect(report.every(row => row.coverage === `${CHOK_UNIVERSE.length}/${CHOK_UNIVERSE.length}`)).toBe(true);
    for (const row of report) {
      const expected = EXPECTED_REGIMES[row.date];
      if (!expected) continue;
      expect(row.detected, `${row.date} 순환 판정`).toBe(expected.detected);
      expect(row.strongest?.sector, `${row.date} 강한 섹터`).toBe(expected.strongest);
      expect(row.weakest?.sector, `${row.date} 약한 섹터`).toBe(expected.weakest);
    }
  },
  60_000,
);
