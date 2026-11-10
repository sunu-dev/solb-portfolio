import { afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ market: vi.fn(), companies: vi.fn(), policies: vi.fn() }));
vi.mock('@/lib/marketWatchStore', () => ({ readMarketWatch: state.market }));
vi.mock('@/lib/marketCause/companyPublication', () => ({ readCompanyExplanations: state.companies }));
vi.mock('@/lib/marketCause/officialPublication', () => ({ readOfficialPolicies: state.policies }));
import { collectAssistantEvidence } from '@/lib/assistantEvidenceSource';
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.clearAllMocks(); });
it('collects same-period industry data, distinguishes market headlines, and keeps reporting collected more than three hours ago and shares public fetches', async () => {
  vi.useFakeTimers(); const now = Date.parse('2026-11-04T07:00:00Z'); vi.setSystemTime(now);
  state.companies.mockResolvedValue({ cards: [], warnings: [] }); state.policies.mockResolvedValue({ cards: [], warnings: [] });
  state.market.mockResolvedValue({ servedAt: new Date(now).toISOString(), runs: [], events: [{ kind: 'market-news', market: 'us', sectors: [], lastObservedAt: '2026-11-03T23:00:00Z', sources: [
    { title: '미국 시장 마감 보도', label: '보도', at: '2026-11-03T22:00:00Z', url: 'https://example.com/same-day' },
    { title: '다음 날 새 사건', label: '보도', at: '2026-11-04T06:00:00Z', url: 'https://example.com/next-day' },
  ] }] });
  const fetcher = vi.fn(async (url: string) => {
    if (url.includes('news.google')) return new Response('<rss><channel></channel></rss>');
    return Response.json({ chart: { result: [{ meta: { regularMarketTime: Date.parse('2026-11-03T21:00:00Z') / 1000, currency: 'USD', exchangeTimezoneName: 'America/New_York' },
      timestamp: ['2026-11-02', '2026-11-03'].map(d => Date.parse(d + 'T14:30:00Z') / 1000), indicators: { quote: [{ close: [100, 102] }] } }] } });
  }); vi.stubGlobal('fetch', fetcher);
  const first = collectAssistantEvidence('MU', '1d'); const second = collectAssistantEvidence('MU', '1d');
  expect(first).toBe(second); const packet = await first;
  expect(packet.comparisons.map(q => q.symbol)).toEqual(['^GSPC', 'SOXX']);
  expect(packet.evidence.find(e => e.id === 'M1')).toMatchObject({ kind: 'headline', scope: 'market', timing: 'after-price', title: '미국 시장 마감 보도' });
  expect(packet.evidence.some(e => e.url.includes('next-day'))).toBe(false);
  expect(state.market).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls.some(([url]) => url.includes('/SOXX?'))).toBe(true);
});

it('separates yesterday from latest in the cache and bounds all quotes and news to the same completed day', async () => {
  vi.useFakeTimers(); const now=Date.parse('2026-11-06T16:00:00Z'); vi.setSystemTime(now);
  state.companies.mockResolvedValue({cards:[],warnings:[]});state.policies.mockResolvedValue({cards:[],warnings:[]});
  state.market.mockResolvedValue({servedAt:new Date(now).toISOString(),runs:[],events:[{kind:'market-news',market:'us',sectors:[],sources:[
    {title:'Nasdaq on prior session',label:'보도',at:'2026-11-05T20:00:00Z',url:'https://example.com/prior'},
    {title:'Nasdaq in new session',label:'보도',at:'2026-11-06T15:00:00Z',url:'https://example.com/new'},
  ]}]});
  const fetcher=vi.fn(async(url:string)=>url.includes('news.google')?new Response('<rss><channel></channel></rss>'):Response.json({chart:{result:[{
    meta:{regularMarketTime:now/1000,currency:'USD',exchangeTimezoneName:'America/New_York'},
    timestamp:['2026-11-04','2026-11-05','2026-11-06'].map(day=>Date.parse(day+'T14:30:00Z')/1000),indicators:{quote:[{close:[100,90,95]}]},
  }]}}));vi.stubGlobal('fetch',fetcher);
  const prior=await collectAssistantEvidence('MU','1d',false,'previous');
  const latest=await collectAssistantEvidence('MU','1d');
  expect(prior.session?.throughDay).toBe('2026-11-05');
  expect(prior.price).toMatchObject({day:'2026-11-05',baselineDay:'2026-11-04',price:90});
  expect(prior.comparisons.map(price=>price.day)).toEqual(['2026-11-05','2026-11-05']);
  expect(prior.evidence.some(source=>source.url==='https://example.com/new')).toBe(false);
  expect(prior.evidence.some(source=>source.url==='https://example.com/prior')).toBe(true);
  expect(latest.price).toMatchObject({day:'2026-11-06',price:95});
  expect(latest.evidence.some(source=>source.url==='https://example.com/new')).toBe(true);
});

it('does not silently retrieve current evidence when the requested market calendar is unknown', async () => {
  vi.useFakeTimers();vi.setSystemTime(Date.parse('2030-11-06T16:00:00Z'));
  const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
  expect(await collectAssistantEvidence('MU','1d',false,'previous')).toMatchObject({sessionUnavailable:true,evidence:[],comparisons:[]});
  expect(fetcher).not.toHaveBeenCalled();
});

it('compares explicit US industries using ETFs while retaining the same dated market overview and distinct cache entries', async () => {
  vi.useFakeTimers(); const now=Date.parse('2026-11-06T16:00:00Z');vi.setSystemTime(now);
  state.companies.mockResolvedValue({cards:[],warnings:[]});state.policies.mockResolvedValue({cards:[],warnings:[]});state.market.mockResolvedValue({events:[],runs:[],servedAt:new Date(now).toISOString()});
  const fetcher=vi.fn(async()=>Response.json({chart:{result:[{meta:{regularMarketTime:now/1000,currency:'USD',exchangeTimezoneName:'America/New_York'},timestamp:['2026-11-04','2026-11-05','2026-11-06'].map(day=>Date.parse(day+'T14:30:00Z')/1000),indicators:{quote:[{close:[100,90,95]}]}}]}}));vi.stubGlobal('fetch',fetcher);
  const market=await collectAssistantEvidence('^GSPC','1d',false,'previous');
  const chips=await collectAssistantEvidence('^GSPC','1d',false,'previous',['semiconductors']);
  const both=await collectAssistantEvidence('^GSPC','1d',false,'previous',['semiconductors','technology']);
  expect(market.comparisons).toEqual([]);
  expect(chips.price).toMatchObject({symbol:'^GSPC',day:'2026-11-05'});
  expect(chips.industryFocus).toEqual(['semiconductors']);
  expect(chips.comparisons).toMatchObject([{symbol:'SOXX',label:'미국 반도체 기업을 담은 SOXX ETF',day:'2026-11-05',baselineDay:'2026-11-04'}]);
  expect(both.comparisons.map(price=>price.symbol)).toEqual(['SOXX','XLK']);
  expect(both.comparisons.every(price=>price.day===both.price?.day&&price.baselineDay===both.price?.baselineDay)).toBe(true);
  expect(await collectAssistantEvidence('^GSPC','1d',false,'previous',['technology','semiconductors'])).toBe(both);
  expect(fetcher.mock.calls.length).toBe(6);
});
