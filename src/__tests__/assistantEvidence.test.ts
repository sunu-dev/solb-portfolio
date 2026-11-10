import { describe, expect, it } from 'vitest';
import { cleanAssistantAnswer, assistantFollowUps, assistantPriceClaimsMatch, assistantMoneyClaimsMatch, assistantElectionClaimsMatch, comparablePrices, parseAssistantPrice, validateAssistantInsights, type AssistantEvidencePacket } from '@/lib/assistantEvidence';
import { assistantNeedsMarketEvidence, parseAssistantQuestion, validAssistantReport } from '@/lib/assistantQuestion';
import { analysisResponseSchema, parseAnalysisResponse } from '@/lib/aiAnalysisResponse';
const now = Date.parse('2026-11-03T22:00:00Z');
function chart() {
  return { chart: { result: [{ meta: { regularMarketTime: Date.parse('2026-11-03T21:00:00Z') / 1000, currency: 'USD', exchangeTimezoneName: 'America/New_York' },
    timestamp: ['2026-10-30', '2026-11-02', '2026-11-03'].map(day => Date.parse(day + 'T14:30:00Z') / 1000),
    indicators: { quote: [{ close: [100, 90, 81] }] }, events: { splits: {} as Record<string, { date: number }> } }] } };
}
const packet: AssistantEvidencePacket = { version: 1, symbol: 'MU', period: '1d', checkedAt: new Date(now).toISOString(), comparisons: [], gaps: [],
  evidence: [{ id: 'P1', kind: 'price', text: '기간 등락 -10%', title: 'MU', publisher: 'Yahoo', url: 'https://finance.yahoo.com', publishedAt: new Date(now).toISOString(), checkedAt: new Date(now).toISOString() }] };
it('distinguishes Korean conjunctions from an unsupported claim that only one company fell', () => {
  const price = parseAssistantPrice('MU', '마이크론 테크놀로지', chart(), '1d', now)!;
  const evidence = { ...packet, price, comparisons: [{ ...price, symbol: 'SOXX', label: '반도체 업종', changePercent: -4 }] };
  for (const text of ['다만 기술주가 하락한 배경을 다룬 보도예요.', '하지만 주가 하락만으로 주문 감소를 확인할 수는 없어요.', '마이크론만 하락한 것은 아니에요.', '마이크론만의 소식으로 하락을 설명할 수는 없어요.']) {
    expect(assistantPriceClaimsMatch({ currentStatus: text }, evidence)).toBe(true);
  }
  for (const text of ['마이크론만 하락했어요.', 'MU만 떨어졌어요.', '이 회사만 하락했어요.']) {
    expect(assistantPriceClaimsMatch({ currentStatus: text }, evidence)).toBe(false);
  }
});
describe('comparable market evidence', () => {
  it('selects the requested completed day and its own range after a new session appears', () => {
    const data = chart();
    data.chart.result[0].indicators.quote[0] = { close: [100,90,81],low:[99,85,75],high:[101,95,83] } as typeof data.chart.result[0]['indicators']['quote'][0];
    const historical = parseAssistantPrice('MU','마이크론',data,'1d',now,'2026-11-02');
    expect(historical).toMatchObject({day:'2026-11-02',baselineDay:'2026-10-30',price:90,changePercent:-10,intradayLowChangePercent:-15,intradayHighChangePercent:-5,timeBasis:'retrieval',at:new Date(now).toISOString()});
    const current = parseAssistantPrice('MU','마이크론',data,'1d',now);
    expect(current).toMatchObject({day:'2026-11-03',price:81});
    expect(current).not.toHaveProperty('timeBasis');
    data.chart.result[0].events.splits = { split:{date:Date.parse('2026-11-03T14:30:00Z')/1000} };
    expect(parseAssistantPrice('MU','MU',data,'1d',now,'2026-11-02')).not.toBeNull();
    expect(parseAssistantPrice('MU','MU',data,'1d',now)).toBeNull();
    expect(parseAssistantPrice('MU','MU',data,'1d',now,'2026-10-29')).toBeNull();
  });
  it('calculates close-to-close change, not open-to-last movement, across the DST weekend', () => {
    const result = parseAssistantPrice('MU', '마이크론', chart(), '1d', now)!;
    expect(result.changePercent).toBe(-10); expect(result.baselineDay).toBe('2026-11-02'); expect(result.day).toBe('2026-11-03');
  });
  it('rejects missing, stale, future, reordered and short price series', () => {
    expect(parseAssistantPrice('MU', 'MU', chart(), '5d', now)).toBeNull();
    expect(parseAssistantPrice('MU', 'MU', chart(), '1d', now + 8 * 86400_000)).toBeNull();
    expect(parseAssistantPrice('MU', 'MU', chart(), '1d', now - 2 * 86400_000)).toBeNull();
    const missing = chart(); missing.chart.result[0].indicators.quote[0].close[1] = NaN;
    expect(parseAssistantPrice('MU', 'MU', missing, '1d', now)).toBeNull();
    const reordered = chart(); reordered.chart.result[0].timestamp.reverse();
    expect(parseAssistantPrice('MU', 'MU', reordered, '1d', now)).toBeNull();
  });
  it('does not describe a split as a price crash', () => {
    const split = chart(); split.chart.result[0].events.splits = { split: { date: Date.parse('2026-11-03T14:30:00Z') / 1000 } };
    expect(parseAssistantPrice('MU', 'MU', split, '1d', now)).toBeNull();
  });
  it('rejects comparisons with mismatched periods, currency or quote times', () => {
    const q = parseAssistantPrice('MU', 'MU', chart(), '1d', now)!;
    expect(comparablePrices(q, { ...q, symbol: 'SOXX' })).toBe(true);
    for (const patch of [{ day: '2026-11-02' }, { baselineDay: '2026-10-30' }, { currency: 'KRW' }]) expect(comparablePrices(q, { ...q, ...patch })).toBe(false);
    expect(comparablePrices(q, { ...q, sessionState: 'intraday', at: '2026-11-03T18:00:00Z' })).toBe(false);
    expect(comparablePrices(q, { ...q, at: '2026-11-03T21:37:09Z' })).toBe(true);
  });
  it('does not turn yesterday’s delayed intraday quote into a closing quote', () => {
    const data = chart();
    data.chart.result[0].meta.regularMarketTime = Date.parse('2026-11-03T18:00:00Z') / 1000;
    expect(parseAssistantPrice('MU', 'MU', data, '1d', Date.parse('2026-11-04T10:00:00Z'))?.sessionState).toBe('intraday');
    expect(parseAssistantPrice('MU', 'MU', data, '1d', now, '2026-11-02')?.sessionState).toBe('closed');
  });
});
describe('bounded conversation and evidence contract', () => {
  const input = { questionConsent: true, questionText: '그 뉴스가 중요한가요?', symbol: 'MU', historySymbol: 'MU', questionHistory: [{ question: '왜 떨어져요?', answer: '이전 설명이며 사실 근거가 아님' }] };
  it('preserves a follow-up topic but rejects another symbol and oversized history', () => {
    expect(assistantNeedsMarketEvidence(parseAssistantQuestion(input)!)).toBe(true);
    expect(parseAssistantQuestion({ ...input, historySymbol: 'NVDA' })).toBeNull();
    expect(parseAssistantQuestion({ ...input, questionHistory: Array(4).fill(input.questionHistory[0]) })).toBeNull();
    expect(parseAssistantQuestion({ ...input, questionPeriod: 'forever' })).toBeNull();
    expect(assistantNeedsMarketEvidence({ text: 'SEEU ON은 어디에 쓰나요?', symbol: '340810.KQ', unclearTerms: [] })).toBe(false);
    expect(parseAssistantQuestion({...input,questionHistory:[{...input.questionHistory[0],sessionReference:'previous'}]})?.history?.[0].sessionReference).toBe('previous');
    expect(parseAssistantQuestion({...input,questionHistory:[{...input.questionHistory[0],sessionReference:'any-date'}]})).toBeNull();
    expect(parseAssistantQuestion({...input,questionHistory:[{...input.questionHistory[0],industryFocus:['semiconductors','technology']}]})?.history?.[0].industryFocus).toEqual(['semiconductors','technology']);
    for(const industryFocus of ['semiconductors',['banking'],['technology','technology'],['semiconductors','technology','technology']]) {
      expect(parseAssistantQuestion({...input,questionHistory:[{...input.questionHistory[0],industryFocus}]})).toBeNull();
    }
  });
  it('does not trust model-invented evidence IDs or leak unrendered provider payloads', () => {
    const insight = { kind: 'interpretation', text: '시장도 함께 움직였다는 사실만으로 이유가 같다고 볼 수는 없어요.', evidenceIds: ['P1'] };
    expect(validateAssistantInsights([insight], packet)).toBe(true);
    expect(validateAssistantInsights([{ ...insight, evidenceIds: ['fake'] }], packet)).toBe(false);
    const report = { currentStatus: '확인된 자료를 살펴봤어요.', keyAdvice: ['기간을 함께 확인해요.'], conclusion: { label: '확인', signal: 'neutral', desc: '같은 기간을 비교해요.' }, assistantInsights: [insight], followUps: ['어떤 기간인가요?', '비교가 왜 필요한가요?'], privatePayload: 'not allowed' };
    const parsed = parseAnalysisResponse(JSON.stringify(report), true, 'STOP', undefined, true);
    expect(parsed).not.toHaveProperty('privatePayload'); expect(validAssistantReport(parsed, packet, true)).toBe(true);
    expect(validAssistantReport({ ...parsed, followUps: ['똑같은 질문', '똑같은 질문'] }, packet, true)).toBe(false);
    expect(validAssistantReport(parsed, undefined, true)).toBe(false);
    expect(analysisResponseSchema(true, true, false, true).required).toContain('assistantInsights');
    expect(analysisResponseSchema(true, true).required).not.toContain('assistantInsights');
  });
});


it('keeps an intraday decline visible even after the last price recovers', () => {
  const data = chart(); data.chart.result[0].indicators.quote[0] = { close: [100, 90, 91], low: [99, 88, 81], high: [101, 96, 93] } as typeof data.chart.result[0]['indicators']['quote'][0];
  const q = parseAssistantPrice('MU', 'MU', data, '1d', now)!;
  expect(q.changePercent).toBe(1.11); expect(q.intradayLowChangePercent).toBe(-10);
});

it('distinguishes a forming daily bar from a close and blocks the observed premature closing claim', () => {
  const data=chart(), live=Date.parse('2026-11-03T16:35:00Z');
  data.chart.result[0].meta.regularMarketTime=live/1000;
  const price=parseAssistantPrice('MU','마이크론',data,'1d',live)!;
  expect(price.sessionState).toBe('intraday');
  const evidence={...packet,price};
  expect(assistantPriceClaimsMatch({currentStatus:'마이크론은 상승 마감했어요.'},evidence)).toBe(false);
  expect(assistantPriceClaimsMatch({currentStatus:'마감 기준 올랐어요.'},evidence)).toBe(false);
  expect(assistantPriceClaimsMatch({currentStatus:'장중에 하락했어요. 마감 가격은 아직 몰라요.'},evidence)).toBe(true);
  expect(parseAssistantPrice('MU','MU',data,'1d',now)?.sessionState).toBe('intraday');
  expect(parseAssistantPrice('MU','MU',data,'1d',live,'2026-11-02')?.sessionState).toBe('closed');
  expect(parseAssistantPrice('MU','MU',chart(),'1d',now)?.sessionState).toBe('closed');
});

it('marks the US early-close daily bar as closed only after its actual early close', () => {
 const data=chart();
 data.chart.result[0].timestamp=['2026-11-24','2026-11-25','2026-11-27'].map(day=>Date.parse(day+'T14:30:00Z')/1000);
 const before=Date.parse('2026-11-27T17:59:00Z'),after=Date.parse('2026-11-27T18:00:00Z');
 data.chart.result[0].meta.regularMarketTime=before/1000;
 expect(parseAssistantPrice('MU','MU',data,'1d',before)?.sessionState).toBe('intraday');
 data.chart.result[0].meta.regularMarketTime=after/1000;
 expect(parseAssistantPrice('MU','MU',data,'1d',after)?.sessionState).toBe('closed');
});
it('accepts known index units without guessing currencies for unknown instruments', () => {
  const data = chart(); data.chart.result[0].meta.currency = '';
  expect(parseAssistantPrice('^GSPC', 'S&P 500', data, '1d', now)?.currency).toBe('USD');
  expect(parseAssistantPrice('UNKNOWN', 'UNKNOWN', data, '1d', now)).toBeNull();
});

it('blocks the actual live-response regression: positive daily low described as a fall', () => {
  const withPrice = { ...packet, price: { symbol:'MU',label:'마이크론',day:'2026-11-03',baselineDay:'2026-11-02',at:'2026-11-03T21:00:00Z',price:100,changePercent:2.58,currency:'USD',intradayLowChangePercent:1.4 } };
  expect(assistantPriceClaimsMatch({ currentStatus:'전일 종가보다 1.4%까지 내려간 시점이 있었어요.' }, withPrice)).toBe(false);
  expect(assistantPriceClaimsMatch({ currentStatus:'최저 가격도 전일 종가보다 1.4% 높았어요.' }, withPrice)).toBe(true);
  expect(assistantPriceClaimsMatch({ currentStatus:'주가는 5.8% 하락했어요.' }, withPrice)).toBe(false);
  expect(assistantPriceClaimsMatch({ currentStatus:'자료 M1을 보세요.' }, withPrice)).toBe(false);
});

it('does not offer follow-up buttons for unimplemented intraday timestamps or peer quotes', () => {
 const follow = assistantFollowUps(['장중에 가장 크게 내려간 시간대는 언제인가요?', '같은 날 다른 대형 회사들도 함께 움직였나요?']);
 expect(follow).toHaveLength(2);expect(follow.join(' ')).not.toMatch(/시간대|대형 회사/);
});

it('removes known internal citation IDs from prose while rejecting fabricated ones', () => {
  const evidence = { ...packet, evidence: [...packet.evidence, { ...packet.evidence[0], id: 'A1' }] };
  const report = cleanAssistantAnswer({ currentStatus: 'A1 보도는 정책 우려를 설명해요.', keyAdvice: [], assistantInsights: [{ text: 'P1 가격과 함께 비교해요.', evidenceIds: ['P1'] }], followUps: ['어떤 영향인가요?'] }, evidence);
  expect(report.currentStatus).toBe('보도는 정책 우려를 설명해요.');
  expect((report.assistantInsights as { evidenceIds: string[] }[])[0].evidenceIds).toEqual(['P1']);
  expect(assistantPriceClaimsMatch(cleanAssistantAnswer({ currentStatus: 'A9 보도에 따르면' }, evidence), evidence)).toBe(false);
});


it('quarantines an extreme daily discontinuity when the vendor omits split events', () => {
 const data=chart();data.chart.result[0].indicators.quote[0].close=[465,450.41,138.97];
 expect(parseAssistantPrice('SOXX','반도체 ETF',data,'1d',now)).toBeNull();
 data.chart.result[0].indicators.quote[0].close=[100,90,70];
 expect(parseAssistantPrice('MUU','MUU',data,'1d',now)?.changePercent).toBeCloseTo(-22.22);
});

it('keeps source currency and magnitude, while allowing an explicitly hypothetical example', () => {
 const evidence = { ...packet, evidence: [{ ...packet.evidence[0], kind: 'article' as const, title: 'Micron $4.5 Billion Taiwan Pause', text: 'Construction has paused.' }] };
 expect(assistantMoneyClaimsMatch({currentStatus:'45억 달러 규모 공장 공사 중단 보도가 나왔어요.'}, evidence)).toBe(true);
 expect(assistantMoneyClaimsMatch({currentStatus:'4.5조 원 규모 공장 공사가 멈췄어요.'}, evidence)).toBe(false);
 expect(assistantMoneyClaimsMatch({currentStatus:'45만 달러 규모예요.'}, evidence)).toBe(false);
 expect(assistantMoneyClaimsMatch({currentStatus:'예를 들어 1만 원을 투자했다고 가정할게요.'}, evidence)).toBe(true);
 expect(assistantMoneyClaimsMatch({currentStatus:'투자 규모를 확인하지 못했어요.'}, evidence)).toBe(true);
});

it('rejects the observed midterm election renamed as a presidential election', () => {
 const evidence = { ...packet, evidence: [{ ...packet.evidence[0], kind: 'article' as const, title: 'Stocks after midterm elections', text: 'Data center concerns weighed on chip stocks.' }] };
 expect(assistantElectionClaimsMatch({currentStatus:'대선 이후 기술주가 하락했어요.'}, evidence)).toBe(false);
 expect(assistantElectionClaimsMatch({currentStatus:'중간선거 이후 규제 우려를 보도했어요.'}, evidence)).toBe(true);
 expect(assistantElectionClaimsMatch({currentStatus:'대통령 선거 당시와 비교했어요.'}, {...evidence,evidence:[{...evidence.evidence[0],text:'Comparison with the presidential election.'}]})).toBe(true);
});
