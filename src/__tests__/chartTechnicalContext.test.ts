import { describe, expect, it } from 'vitest';
import { chartTechnicalContext, chartObservationText } from '@/lib/chartTechnicalContext';
import { analysisResponseSchema, parseAnalysisResponse } from '@/lib/aiAnalysisResponse';
import { financialTermMatches } from '@/lib/financialTerms';
import type { IntradayCandles } from '@/lib/intradayCandles';
const first = Date.parse('2026-11-03T00:00:00Z') / 1000;
function data(c = Array.from({ length: 42 }, (_, i) => 100 + i)): IntradayCandles {
  return { s: 'ok', interval: '5m', sessionDate: '2026-11-03', timeZone: 'Asia/Seoul', asOf: first + (c.length - 1) * 300,
    t: c.map((_, i) => first + i * 300), o: c.map(n => n - .2), h: c.map(n => n + 1), l: c.map(n => n - 1), c, v: c.map((_, i) => i >= c.length - 5 ? 200 : 100) };
}
describe('observations for multiple chart reading methods', () => {
  it('uses period-aligned means, exact band boundaries, momentum and a separate volume comparison', () => {
    const result = chartTechnicalContext(data())!;
    expect(result.facts.trend.average20).toBe(131.5); expect(result.facts.trend.average5).toBe(139);
    expect(result.facts.trend.consecutiveAbove20).toBe(23);
    expect(result.facts.bollinger?.middle).toBe(131.5);
    expect(result.facts.bollinger?.upper).toBeCloseTo(131.5 + 2 * Math.sqrt(33.25), 3);
    expect(result.facts.volume?.ratio).toBe(2); expect(result.facts.rsi?.value).toBe(100);
    expect(result.facts.macd?.value).toBeGreaterThan(0);
    expect(result.overlays.bands).toHaveLength(23); expect(result.availableViews).toContain('macd');
    expect(result.facts.basis.note).toContain('20일선이 아닌');
  });
  it('counts consecutive observations below the correctly aligned average', () => {
    const result = chartTechnicalContext(data(Array.from({ length: 42 }, (_, i) => 142 - i)))!;
    expect(result.facts.trend.average20).toBe(110.5); expect(result.facts.trend.consecutiveBelow20).toBe(23);
    expect(result.facts.trend.consecutiveAbove20).toBe(0); expect(result.facts.rsi?.value).toBe(0);
    expect(chartObservationText(result.facts, 'USD').trend).toContain('20개 평균 아래');
  });
  it('describes lower highs/lows without labelling every descending sequence a wedge or W', () => {
    const result = chartTechnicalContext(data(Array.from({ length: 60 }, (_, i) => 100 - i * .2 + Math.sin(i * Math.PI / 3))))!;
    expect(result.facts.levels.highLowSequence).toEqual({ highs: 'below', lows: 'below' });
    expect(result.facts.levels.recentPeaks).toHaveLength(2); expect(result.facts.levels.recentTroughs).toHaveLength(2);
  });
  it('does not invent missing volume, long averages, MACD or zero-width band readings', () => {
    const result = chartTechnicalContext({ ...data(Array(20).fill(100)), v: Array(20).fill(0) })!;
    expect(result.facts.trend.average60).toBeNull(); expect(result.facts.bollinger).toBeNull();
    expect(result.facts.rsi).toBeNull(); expect(result.facts.macd).toBeNull(); expect(result.facts.volume).toBeNull();
    expect(result.availableViews).not.toContain('volume'); expect(result.availableViews).not.toContain('bollinger');
    expect(chartTechnicalContext(data([100, 101, 102]))).toBeNull();
  });
  it('uses the methods supported by a short session without fabricating twenty-period bands', () => {
    const result = chartTechnicalContext(data([100, 101, 99, 102, 101]))!;
    expect(result.facts.trend.average5).toBe(100.6); expect(result.facts.trend.average20).toBeNull();
    expect(result.availableViews).toContain('trend'); expect(result.availableViews).toContain('candles');
    expect(result.availableViews).not.toContain('bollinger'); expect(result.availableViews).not.toContain('rsi');
    expect(chartObservationText(result.facts, 'USD').trend).toContain('20개 평균을 계산할 자료는 아직');
  });
  it('discloses gaps without filling prices or labelling 20 observations as a fixed 100 minutes', () => {
    const original = data(), changed = { ...original, t: original.t.map((t, i) => i > 30 ? t + 900 : t), asOf: original.asOf + 900 };
    expect(chartTechnicalContext(changed)!.facts.basis.gapsInLatestTwenty).toBe(1);
    expect(chartTechnicalContext(changed)!.facts.trend.average20).toBe(131.5);
  });
  it('does not turn float noise below the displayed price precision into a broken low', () => {
    const prices = Array.from({ length: 30 }, (_, i) => 203 + Math.sin(i));
    prices.splice(22, 8, 204, 203, 202.0643, 203, 204, 203, 203, 202.059997);
    const result = chartTechnicalContext(data(prices))!;
    expect(result.facts.levels.lastPriceVsLatestTrough).toBe('equal');
    const text = chartObservationText(result.facts, 'USD');
    expect(text.levels).not.toContain('달러으로'); expect(text.trend).not.toContain('달러은'); expect(text.trend).not.toContain('달러이에요');
  });
});
describe('selective chart explanation response', () => {
  const view = (id: string) => ({ view: id, title: '평균보다 낮게 거래돼요', observed: '20개 평균보다 낮아요.', meaning: '최근 받은 가격보다 낮게 거래되는 흐름이에요.', watchNext: '평균과의 차이가 줄어드는지 함께 볼 수 있어요.' });
  const report = { currentStatus: '가격과 거래량을 함께 읽어요.', chartViews: [view('trend'), view('volume')], conclusion: { label: '정보 정리', signal: 'neutral', desc: '같은 날의 5분 구간만 비교했어요.' } };
  it('requires actual observations, their meaning and a checkable next change', () => {
    expect(parseAnalysisResponse(JSON.stringify(report), true, 'STOP', ['trend', 'volume'])).toEqual({ ...report, chartViews: report.chartViews.map(item => ({ view: item.view, title: item.title, meaning: item.meaning, watchNext: item.watchNext })) });
    expect(analysisResponseSchema(true, true, true).required).toContain('chartViews');
    for (const bad of [{ ...report, chartViews: [view('trend'), view('trend')] }, { ...report, chartViews: [view('trend'), view('bollinger')] }, { ...report, chartViews: [] },
      { ...report, chartViews: [{ ...view('trend'), meaning: '' }, view('volume')] }, { currentStatus: '처음과 마지막 가격을 읽었어요.', keyAdvice: ['마지막 가격은 아래쪽이에요.'], conclusion: report.conclusion }])
      expect(() => parseAnalysisResponse(JSON.stringify(bad), true, 'STOP', ['trend', 'volume'])).toThrow('invalid_ai_response');
  });
  it('opens the actual technical terms from prose instead of assuming beginner knowledge', () => {
    const terms = financialTermMatches('볼린저밴드와 이동평균선, RSI·MACD, 5분봉을 함께 읽어요.');
    expect(terms.map(t => t.id)).toEqual(['chart-bollinger', 'chart-average', 'chart-rsi', 'chart-macd', 'chart-candle']);
    expect(financialTermMatches('사업의 전환점을 맞았어요.')).toHaveLength(0);
  });
});
