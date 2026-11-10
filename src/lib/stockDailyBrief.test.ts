import {describe,it,expect} from 'vitest';
import {priceSummary, validBackground, marketDay, type BriefQuote} from './stockDailyBrief';
import {parseDailyQuote,parseBriefNews} from './stockDailyBriefCollector';
const at=Date.parse('2026-10-16T20:00:00Z');
const q:BriefQuote={symbol:'MU',label:'마이크론',day:'2026-10-16',at:new Date(at).toISOString(),change:-5,unusual:false};
describe('daily brief evidence and market dates',()=>{
 it('keeps Friday US trade date on Saturday in Korea',()=>expect(marketDay(at/1000)).toBe('2026-10-16'));
 it('does not compare a different session',()=>expect(priceSummary(q,[{...q,symbol:'SOXX',label:'반도체',day:'2026-10-15'}])).not.toContain('반도체'));
 it('compares changes in percentage points without asserting a cause',()=>{const s=priceSummary(q,[{...q,symbol:'^GSPC',change:-1}]);expect(s).toContain('-4.00%포인트');expect(s).not.toContain('때문');});
 it('rejects invented citation evidence',()=>expect(validBackground({background:'설명',watch:'실적',evidence:[{index:0,quote:'존재하지 않는 기사 근거'}]},[{title:'반도체 주식 하락 소식',url:'https://example.com',at:'',publisher:''}])).toBeNull());
 it('requires sufficient price history for exceptional move classification',()=>{
 const body={chart:{result:[{meta:{regularMarketTime:at/1000},timestamp:[at/1000-86400,at/1000],indicators:{quote:[{close:[100,95]}]}}]}};
 expect(parseDailyQuote('MU','마이크론',body,at+1000)).toMatchObject({change:expect.closeTo(-5),unusual:false});
 expect(parseDailyQuote('MU','마이크론',body,at-86400000)).toBeNull();
 expect(parseDailyQuote('MU','마이크론',body,at+8*86400000)).toBeNull();
 });
 it('filters future, wrong-day and non-https news',()=>{
 const item=(date:string,url:string)=>`<item><title>반도체 하락 보도</title><pubDate>${date}</pubDate><link>${url}</link></item>`;
 expect(parseBriefNews(item('2026-10-16T19:00:00Z','https://example.com')+item('2026-10-12T19:00:00Z','https://example.org')+item('2026-10-16T21:00:00Z','https://future.example')+item('2026-10-16T19:00:00Z','javascript:alert(1)'),'2026-10-16',at)).toHaveLength(1);
 });
});
it('does not call a weekend without a scheduled run a collection delay', async()=>{
 const {isBriefDelayed}=await import('./stockDailyBrief');
 expect(isBriefDelayed('2026-10-16T21:15:00Z',Date.parse('2026-10-18T04:00:00Z'))).toBe(false);
 expect(isBriefDelayed('2026-10-16T21:15:00Z',Date.parse('2026-10-19T22:00:00Z'))).toBe(false);
 expect(isBriefDelayed('2026-10-16T21:15:00Z',Date.parse('2026-10-19T23:30:00Z'))).toBe(true);
});


it('contains the observed production contradiction and does not treat search links as fact checks', async () => {
 const { publicDailyBrief, DAILY_BRIEF_BACKGROUND_ENABLED } = await import('./stockDailyBrief');
 const brief = publicDailyBrief({ version:3, symbol:'MU', quote:{...q,change:2.58}, comparisons:[], checkedAt:q.at, sources:[],
   summary:'stale generated summary', background:'마이크론은 같은 날 5.8% 하락했고 매출은 379.1% 증가했어요.', watch:'unsupported forecast', searchEntry:'<script>unknown</script>', warnings:[] });
 expect(brief.background).toBeNull();expect(brief.watch).toBeNull();expect(brief.searchEntry).toBeNull();
 expect(brief.summary).toContain('2.58% 상승');expect(brief.warnings[0]).toContain('표시를 중단');
 expect(DAILY_BRIEF_BACKGROUND_ENABLED).toBe(false);
});
