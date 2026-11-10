import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement, ReactNode } from 'react';
import { getUsClockChangeNotice } from '@/utils/usClockChange';
import { getMarketStatus } from '@/utils/marketHours';
import BrokerHoldingsFilter, { brokerHoldingChoices } from '@/components/portfolio/BrokerHoldingsFilter';
import UsMarketClockNotice from '@/components/portfolio/UsMarketClockNotice';
import type { StockItem } from '@/config/constants';
import MarketFlowBriefing from '@/components/market/MarketFlowBriefing';
import type { MarketFlowBrief } from '@/lib/marketFlowEngine';

it('connects holdings in different brokers even without purchase prices, without repeating the same company', () => {
  const brief: MarketFlowBrief = {
    id: 'test-brief', market: 'us', sessionDate: '2026-11-03', asOf: '2026-11-03T01:00:00Z', checkedAt: null,
    freshness: 'current', severity: 'ordinary', pattern: 'mixed', headline: '시험용 시장 소식', summary: '연결 동작을 확인하는 가상 자료예요.',
    benchmarks: [], breadth: null, sectorExplanation: null, sectors: [], companies: [], explanationState: 'sourced',
    evidence: [{ id: 'test-source', market: 'us', sessionDate: '2026-11-03', availableAfter: '2026-11-03T00:00:00Z', scope: 'company', symbols: ['AAPL'], title: '시험용 배경', fact: '가상 자료', interpretation: '연결 시험', next: '다음 확인', sources: [] }],
    recentReleases: [], relatedNews: [], nextChecks: [], limitations: [],
  };
  const holdings = [{ symbol: 'AAPL', name: '애플', shares: 1, avgCost: 0, broker: 'toss' }, { symbol: ' aapl ', name: '애플', shares: 2, avgCost: 0, broker: 'kiwoom' },
    { symbol: 'AAPL', name: '체험 종목', shares: 3, avgCost: 10, demo: true }, { symbol: 'AAPL', name: '수량 없는 종목', shares: 0, avgCost: 10 }] as StockItem[];
  const html = renderToStaticMarkup(<MarketFlowBriefing brief={brief} holdings={holdings} />);
  expect(html).toContain('애플 기록이 이 브리핑과 연결돼요');
  expect(html).not.toContain('애플 · 애플'); expect(html).not.toContain('체험 종목'); expect(html).not.toContain('수량 없는 종목');
});

describe('registered brokers at the holdings list', () => {
  const items = [{ symbol: 'SOXL', broker: 'toss' }, { symbol: 'SOXL', broker: 'kiwoom' }, { symbol: 'SGOV', broker: 'kiwoom' }, { symbol: 'AAPL' }] as StockItem[];
  it('keeps identical tickers in their original brokers and exposes unassigned records', () => {
    expect(brokerHoldingChoices(items)).toEqual([
      { id: 'toss', label: '토스증권', count: 1 }, { id: 'kiwoom', label: '키움증권', count: 2 }, { id: 'unspecified', label: '증권사 미지정', count: 1 },
    ]);
    const html = renderToStaticMarkup(<BrokerHoldingsFilter items={items} active="kiwoom" onSelect={() => {}} />);
    expect(html).toContain('aria-pressed="true"><span>키움증권');
    expect(html).toContain('전체');
    expect(html).not.toContain('평가금액');
  });
  it('selects a broker and returns to the full list through the actual controls', () => {
    const select = vi.fn();
    const tree = BrokerHoldingsFilter({ items, active: 'kiwoom', onSelect: select });
    const buttons: ReactElement<{onClick: () => void; children: ReactNode}>[] = [];
    function visit(node: ReactNode) {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!node || typeof node !== 'object' || !('props' in node)) return;
      const element = node as ReactElement<{onClick: () => void; children: ReactNode}>;
      if (element.type === 'button') buttons.push(element);
      visit(element.props.children);
    }
    visit(tree);
    buttons[1].props.onClick(); expect(select).toHaveBeenLastCalledWith('toss');
    buttons[0].props.onClick(); expect(select).toHaveBeenLastCalledWith(null);
  });
});

describe('US clock changes before the first affected session', () => {
  it('announces the autumn change in advance and keeps the explanation after it', () => {
    const before = getUsClockChangeNotice(new Date('2026-10-30T03:00:00Z'))!;
    expect(before.status).toBe('upcoming');
    expect(before.firstOpen).toBe(Date.parse('2026-11-02T14:30:00Z'));
    expect(before.message).toContain('밤 10시 30분'); expect(before.message).toContain('밤 11시 30분');
    const after = getUsClockChangeNotice(new Date('2026-11-03T03:00:00Z'))!;
    expect(after.status).toBe('applied'); expect(after.hours).toContain('오전 6시');
    expect(getUsClockChangeNotice(new Date('2026-11-10T03:00:00Z'))).toBeNull();
  });
  it('announces the spring direction using the next supported calendar year', () => {
    const notice = getUsClockChangeNotice(new Date('2027-03-12T03:00:00Z'))!;
    expect(notice.firstOpen).toBe(Date.parse('2027-03-15T13:30:00Z'));
    expect(notice.title).toContain('빨라져요'); expect(notice.hours).toContain('밤 10시 30분');
    expect(getUsClockChangeNotice(new Date('2029-03-10T03:00:00Z'))).toBeNull();
    expect(getUsClockChangeNotice(new Date('invalid'))).toBeNull();
  });
  it('uses published future holidays and early closes without inventing a New Year holiday in 2028', () => {
    expect(getMarketStatus(new Date('2027-06-18T15:00:00Z')).phase).toBe('holiday');
    expect(getMarketStatus(new Date('2027-11-26T18:00:00Z')).phase).toBe('post');
    expect(getMarketStatus(new Date('2028-07-03T17:00:00Z')).phase).toBe('post');
    expect(getMarketStatus(new Date('2027-12-31T15:00:00Z')).phase).toBe('open');
  });
  it('renders the meaning and official sources but no server-clock guess', () => {
    const html = renderToStaticMarkup(<UsMarketClockNotice now={Date.parse('2026-11-03T03:00:00Z')} />);
    expect(html).toContain('왜 시간이 바뀌나요'); expect(html).toContain('서머타임은');
    expect(html).toContain('nyse.com'); expect(html).toContain('nist.gov');
    expect(renderToStaticMarkup(<UsMarketClockNotice now={0} />)).toBe('');
  });
});
