import { describe, expect, it } from 'vitest';
import { assistantMoneyClaimsMatch, comparablePrices, parseAssistantPrice, type AssistantEvidencePacket } from '@/lib/assistantEvidence';

// 2026-11-11 00:10 KST에 실제로 받은 모양: 한국 장 마감 뒤 마지막 일봉의 종가만 비어 있었다.
const days = ['2026-11-05', '2026-11-06', '2026-11-09', '2026-11-10'];
function chart(lastClose: number | null, marketTime: string, marketPrice?: number) {
  return { chart: { result: [{ meta: { regularMarketTime: Date.parse(marketTime) / 1000, regularMarketPrice: marketPrice, currency: 'KRW', exchangeTimezoneName: 'Asia/Seoul' },
    timestamp: days.map(day => Date.parse(day + 'T00:00:00Z') / 1000),
    indicators: { quote: [{ close: [201500, 188700, 189900, lastClose], low: [199800, 179200, 187000, 196400], high: [213500, 196500, 195400, 201500] }] } }] } };
}
describe('Korean daily prices after the close', () => {
  const midnight = Date.parse('2026-11-10T15:10:00Z');
  it('fills an empty final close from the same-day last trade instead of dropping the price', () => {
    const price = parseAssistantPrice('005930.KS', '삼성전자', chart(null, '2026-11-10T06:30:19Z', 198900), '1d', midnight);
    expect(price).toMatchObject({ day: '2026-11-10', baselineDay: '2026-11-09', price: 198900, changePercent: 4.74, sessionState: 'closed' });
  });
  it('still rejects the window when no same-day last trade exists', () => {
    expect(parseAssistantPrice('005930.KS', '삼성전자', chart(null, '2026-11-10T06:30:19Z'), '1d', midnight)).toBeNull();
    // An empty close in the middle of the window is never filled.
    const data = chart(198900, '2026-11-10T06:30:19Z', 198900);
    (data.chart.result[0].indicators.quote[0].close as (number | null)[])[2] = null;
    expect(parseAssistantPrice('005930.KS', '삼성전자', data, '1d', midnight)).toBeNull();
  });
  it('compares a closed stock with its closed index even when their last ticks are hours apart', () => {
    const stock = parseAssistantPrice('005930.KS', '삼성전자', chart(198900, '2026-11-10T06:30:19Z', 198900), '1d', midnight)!;
    const index = parseAssistantPrice('^KS11', '코스피', chart(190000, '2026-11-10T11:05:40Z', 190000), '1d', midnight)!;
    expect(comparablePrices(stock, index)).toBe(true);
  });
  it('does not call a session still trading closed', () => {
    const noon = Date.parse('2026-11-10T03:00:00Z');
    expect(parseAssistantPrice('005930.KS', '삼성전자', chart(198900, '2026-11-10T02:59:00Z', 198900), '1d', noon)!.sessionState).toBe('intraday');
  });
});

describe('Korean compound amounts', () => {
  const packet: AssistantEvidencePacket = { version: 1, symbol: '005930.KS', period: '5d', checkedAt: '2026-11-10T15:00:00Z', comparisons: [], gaps: [],
    evidence: [{ id: 'A1', kind: 'article', scope: 'market', title: '외국인 순매도', text: '외국인은 코스피에서 3조4000억원어치를 순매도했고 두 종목에 2조 7,000억 원이 몰렸다. 개인은 1조3400억원을 샀다.', url: 'https://www.news1.kr/a', publisher: '뉴스1', publishedAt: '2026-11-05', checkedAt: '2026-11-10T15:00:00Z' }] };
  it('accepts the same amount written in a shorter unit', () => {
    expect(assistantMoneyClaimsMatch({ currentStatus: '외국인이 3.4조 원어치를 팔았고 두 회사에 2.7조 원이 몰렸어요.' }, packet)).toBe(true);
    expect(assistantMoneyClaimsMatch({ currentStatus: '개인은 1조3400억원어치를 샀어요.' }, packet)).toBe(true);
  });
  it('still rejects a rounded or different amount', () => {
    expect(assistantMoneyClaimsMatch({ currentStatus: '외국인이 3.5조 원어치를 팔았어요.' }, packet)).toBe(false);
    expect(assistantMoneyClaimsMatch({ currentStatus: '개인은 1.3조 원을 샀어요.' }, packet)).toBe(false);
    expect(assistantMoneyClaimsMatch({ currentStatus: '외국인이 3400억 원어치를 팔았어요.' }, packet)).toBe(false);
  });
});
