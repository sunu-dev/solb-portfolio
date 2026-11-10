import { describe, expect, it } from 'vitest';
import { chartSessionFacts } from '@/lib/chartAnalysis';
import { intradaySnapshotId } from '@/lib/intradaySource';
import type { IntradayCandles } from '@/lib/intradayCandles';
const first = Date.parse('2026-11-03T00:00:00Z') / 1000;
const chart: IntradayCandles = { s: 'ok', interval: '5m', sessionDate: '2026-11-03', timeZone: 'Asia/Seoul', asOf: first + 1500,
  t: [0, 1, 2, 3, 4, 5].map(i => first + i * 300), o: [1340, 1293, 1308, 1285, 1250, 1258], h: [1350, 1310, 1310, 1290, 1265, 1280],
  l: [1290, 1290, 1280, 1249, 1249, 1250], c: [1293, 1308, 1285, 1250, 1258, 1275], v: [100, 200, 150, 300, 250, 100] };
describe('facts for the visible five-minute price chart', () => {
  it('distinguishes line extrema from within-bar trade extrema and changes from the first plotted price', () => {
    const facts = chartSessionFacts(chart);
    expect(facts.firstLinePrice).toBe(1293); expect(facts.lastLinePrice).toBe(1275); expect(facts.changeFromFirstLinePercent).toBe(-1.39);
    expect(facts.lineHigh).toEqual({ price: 1308, barStart: '09:05' });
    expect(facts.lineLow).toEqual({ price: 1250, barStart: '09:15' });
    expect(facts.tradedHigh).toBe(1350); expect(facts.tradedLow).toBe(1249); expect(facts.portions).toHaveLength(3);
  });
  it('binds the exact plot, ignoring response bookkeeping timestamps', () => {
    expect(intradaySnapshotId(chart)).toBe(intradaySnapshotId({ ...chart, receivedAt: Date.now(), snapshotId: 'ignored' }));
    expect(intradaySnapshotId({ ...chart, c: [1293, 1308, 1285, 1250, 1258, 1276] })).not.toBe(intradaySnapshotId(chart));
  });
  it('holds cross-date, unordered, inconsistent and insufficient data', () => {
    for (const bad of [{ ...chart, sessionDate: '2026-11-02' }, { ...chart, t: [...chart.t].reverse() }, { ...chart, h: chart.h.map(() => 1) }, { ...chart, t: [first] }])
      expect(() => chartSessionFacts(bad)).toThrow();
  });
  it('counts longer gaps without inferring their cause or inserting prices', () => {
    const missing = { ...chart, t: chart.t.map((t, i) => i > 2 ? t + 300 : t), asOf: chart.asOf + 300 };
    expect(chartSessionFacts(missing).gapsLongerThanFiveMinutes).toBe(1); expect(chartSessionFacts(missing).bars).toBe(6);
  });
});
