import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import EventStockImpactCard from '@/components/events/EventStockImpactCard';
import type { EventCacheEntry, PresetEvent } from '@/config/constants';

const event: PresetEvent = { id: 'test', name: '비교', emoji: '', startDate: '2026-01-02', baseDate: '2026-01-01',
  endDate: null, description: '', insight: '', basePrices: {}, baseMacro: {} };
const entry: EventCacheEntry = { basePrice: 100000, maxDrop: -.0000001, maxDropPrice: 100000,
  lastDate: '2026-01-30', lastPrice: 100000, currentChange: 0, recovered: false, recoveryDays: null, dataSource: 'fetched' };

const render = (overrides: Partial<Parameters<typeof EventStockImpactCard>[0]> = {}) => renderToStaticMarkup(createElement(EventStockImpactCard, {
  symbol: '005930.KS', currency: 'USD', avgCost: 100000,
  event, entry, ...overrides,
}));

describe('event comparison prices', () => {
  it('keeps Korean quote, basis, low and cost in won even with old incorrect currency metadata', () => {
    const html = render();
    expect(html).toContain('₩100,000');
    expect(html).not.toContain('$100000');
    expect(html).not.toContain('$100,000');
    expect(html).not.toContain('-0.0%');
    expect(html).not.toContain('+0.0%');
    expect(html).toContain('삼성전자');
    expect(html).toContain('2026-01-30');
    expect(html).toContain('마지막 확인 종가');
  });
  it('uses the dated last close for a finished event, ignoring a mismatched cached percentage', () => {
    const html = render({ event: { ...event, endDate: '2026-02-01' },
      entry: { ...entry, lastPrice: 90000, currentChange: 400 } });
    expect(html).toContain('₩90,000');
    expect(html).not.toContain('₩500,000');
    expect(html).not.toContain('내 평균 매수가');
  });
  it('does not invent a maximum drawdown or recovery from a basis price and current quote alone', () => {
    const html = render({ entry: { ...entry, dataSource: 'actual' } });
    expect(html).not.toContain('시작가 대비 최대 하락');
    expect(html).toContain('구간 전체의 가격 자료가 없어');
  });
  it('does not display an undated last price as a verified current comparison', () => {
    const html = render({ entry: { ...entry, lastDate: undefined } });
    expect(html).toContain('미확인');
    expect(html).not.toContain('내 평균 매수가');
  });
  it('reports an observed recovery date without treating missing bars as trading days', () => {
    const html = render({ entry: { ...entry, maxDrop: -10, recovered: true, recoveryDays: 2, recoveryDate: '2026-01-28' } });
    expect(html).toContain('2026-01-28');
    expect(html).not.toContain('2거래일');
  });
  it('uses stored names for companies outside the static name catalog', () => {
    const html = render({ symbol: 'ZZTEST', name: '새로운 회사', currency: 'USD', entry: { ...entry, basePrice: 100, lastPrice: 120 } });
    expect(html).toContain('새로운 회사');
    expect(html).toContain('$120.00');
  });
});
