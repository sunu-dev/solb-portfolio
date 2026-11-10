import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
vi.mock('@/lib/serverLogger',()=>({logServerApi:vi.fn()}));
import {GET} from '@/app/api/news/route';
const feed=(body='')=>new Response(`<rss><channel>${body}</channel></rss>`);
const item=(title:string,date:string)=>`<item><title>${title} - Source</title><link>https://example.com/${title}</link><pubDate>${date}</pubDate><source>Source</source></item>`;
let request:ReturnType<typeof vi.fn>;
beforeEach(()=>{request=vi.fn();vi.stubGlobal('fetch',request)});
afterEach(()=>vi.unstubAllGlobals());
const load=(params='q=Microsoft&locale=en')=>GET(new NextRequest(`http://localhost/api/news?${params}`));
describe('news provider failures',()=>{
 it.each([new Response('blocked',{status:429}),new Response('<html>blocked</html>')])('does not turn a failed/blocked provider into an empty feed',async response=>{
  request.mockResolvedValue(response);const result=await load();expect(result.status).toBe(502);expect(result.headers.get('cache-control')).toBe('no-store');
 });
 it('does not cache a truncated RSS response as a valid empty result',async()=>{
  request.mockResolvedValue(new Response('<rss><channel><item><title>Partial'));
  const response=await load();
  expect(response.status).toBe(502);expect(response.headers.get('cache-control')).toBe('no-store');
 });
 it('distinguishes valid empty feeds from a network failure',async()=>{
  request.mockResolvedValueOnce(feed());expect((await load()).status).toBe(200);
  request.mockRejectedValueOnce(Error('offline'));expect((await load()).status).toBe(502);
 });
 it('uses the Korean regional fallback before reporting failure',async()=>{
  request.mockRejectedValueOnce(Error('blocked')).mockResolvedValueOnce(feed(item('기사',new Date().toUTCString())));
  const result=await load('q=삼성전자');expect(result.status).toBe(200);expect((await result.json()).items).toHaveLength(1);expect(request).toHaveBeenCalledTimes(2);
 });
 it('reports an error if both regions fail',async()=>{
  request.mockRejectedValue(Error('offline'));expect((await load('q=삼성전자')).status).toBe(502);
 });
 it('filters future or invalid dates and respects short time windows',async()=>{
  request.mockResolvedValue(feed(item('now',new Date().toUTCString())+item('old',new Date(Date.now()-2*3600000).toUTCString())+item('future',new Date(Date.now()+86400000).toUTCString())));
  const response=await load('q=Microsoft&locale=en&maxHours=1');expect((await response.json()).items.map((row:{title:string})=>row.title)).toEqual(['now']);
 });
 it.each(['NaN','-1','0','721'])('rejects invalid window %s without querying a provider',async hours=>{
  expect((await load(`q=Microsoft&maxHours=${hours}`)).status).toBe(400);expect(request).not.toHaveBeenCalled();
 });
});

describe('company feed window and identity', () => {
 it('bounds upstream company search so old relevance-ranked stories do not conceal recent coverage',async()=>{
  request.mockImplementation(async(url:string)=>{
   const q=new URL(url).searchParams.get('q')??'';
   return feed(q.includes('when:7d')
    ? item('코아스템켐온, 제조소 변경허가 신청',new Date(Date.now()-4*86400000).toUTCString())
      +item('다른 회사의 공급 계약',new Date().toUTCString())
      +item('코아스템켐온 예전 기사',new Date(Date.now()-20*86400000).toUTCString())
    :item('코아스템켐온 예전 기사',new Date(Date.now()-20*86400000).toUTCString()));
  });
  const response=await load('symbol=166480.KQ&maxHours=168');
  expect((await response.json()).items.map((row:{title:string})=>row.title)).toEqual(['코아스템켐온, 제조소 변경허가 신청']);
 });
 it('never reports no news when an empty search is followed by an unavailable fallback', async () => {
  request.mockResolvedValueOnce(feed()).mockRejectedValueOnce(Error('timeout'));
  const response = await load('symbol=166480.KQ&maxHours=168');
  expect(response.status).toBe(502);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect((await response.json())._meta).toMatchObject({status:'unavailable',attempts:[{status:'empty'},{status:'unavailable'}]});
 });
 it('checks English company coverage when Korean US-company news is empty',async()=>{
  request.mockResolvedValueOnce(feed()).mockResolvedValueOnce(feed(item('CarGurus reports new product',new Date().toUTCString())));
  const response=await load('symbol=CARG&maxHours=168');
  expect((await response.json()).items).toHaveLength(1);
  expect(request.mock.calls[1][0]).toContain('ceid=US:en');
  expect(new URL(request.mock.calls[1][0]).searchParams.get('q')).toContain('when:7d');
 });
 it('uses the same issuer search and seven-day filter regardless of a numeric display-name hint',async()=>{
  const date=new Date(Date.now()-4*86400000).toUTCString();
  request.mockImplementation(async()=>feed(item('코아스템켐온, 공급 재개',date)));
  const plain=await (await load('symbol=166480.KQ&maxHours=168')).json();
  const hinted=await (await load('q=166480.KQ%20주가&symbol=166480.KQ&locale=ko&maxHours=168')).json();
  expect(plain.items).toHaveLength(1);expect(hinted.items).toEqual(plain.items);
  expect(request.mock.calls[0][0]).toBe(request.mock.calls[1][0]);
 });
 it('decodes XML entities before company matching and preserves encoded link parameters',async()=>{
  const date=new Date().toUTCString();
  request.mockResolvedValue(feed(`<item data-provider="news"><title>AT&amp;T announces results - Source</title><link>https://example.com/article?a=1&amp;b=2</link><pubDate>${date}</pubDate><source>Source</source></item>`));
  const response=await load('symbol=T&q=AT%26T&locale=en&maxHours=168');
  expect((await response.json()).items).toMatchObject([{title:'AT&T announces results',link:'https://example.com/article?a=1&b=2'}]);
 });
 it('keeps five-day-old company articles while rejecting another affiliate',async()=>{
  request.mockResolvedValue(feed(item('삼성SDI 실적',new Date().toUTCString())+item('삼성전자 실적',new Date(Date.now()-5*86400000).toUTCString())));
  const response=await load('symbol=005930.KS&q=삼성전자&maxHours=168');
  expect((await response.json()).items.map((row:{title:string})=>row.title)).toEqual(['삼성전자 실적']);
 });
 it('tries an exact alias after an empty primary query, without accepting a different company',async()=>{
  request.mockResolvedValueOnce(feed()).mockResolvedValueOnce(feed(item('Samsung Electronics expands chip production',new Date().toUTCString())+item('Samsung SDI battery contract',new Date().toUTCString())));
  const response=await load('symbol=005930.KS&q=삼성전자&maxHours=168');
  expect((await response.json()).items).toHaveLength(1);
  expect(decodeURIComponent(request.mock.calls[1][0])).toContain('"Samsung Electronics"');
 });
});
