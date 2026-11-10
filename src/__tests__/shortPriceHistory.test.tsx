import {describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {readDailyCandles,validDailyCandles} from '@/lib/dailyCandles';
import ShortPriceHistory from '@/components/analysis/ShortPriceHistory';
const raw={s:'ok',t:[1,2],o:[2,3],h:[3,4],l:[1,2],c:[2,3],v:[10,20]};
describe('short or unavailable price history',()=>{
 it('keeps a new listing chart even before 20 sessions exist',async()=>{
  const request=vi.fn().mockResolvedValue(new Response(JSON.stringify(raw)));
  expect(await readDailyCandles('IPO',request)).toEqual({status:'ready',data:raw});
  const html=renderToStaticMarkup(<ShortPriceHistory raw={raw} status="ready" currency="USD" onRetry={()=>{}}/>);
  expect(html).toContain('role="img"');expect(html).toContain('2거래일');expect(html).not.toContain('매수');
 });
 it('distinguishes missing history from a server failure and exposes retry',async()=>{
  expect((await readDailyCandles('X',vi.fn().mockResolvedValue(new Response('{"s":"no_data"}')))).status).toBe('empty');
  expect((await readDailyCandles('X',vi.fn().mockResolvedValue(new Response('{}',{status:502})))).status).toBe('error');
  const html=renderToStaticMarkup(<ShortPriceHistory status="error" currency="USD" onRetry={()=>{}}/>);
  expect(html).toContain('일별 자료 다시 불러오기');expect(html).not.toContain('자료가 없어요');
 });
 it('rejects malformed, mismatched and unsorted series before chart rendering',()=>{
  expect(validDailyCandles(raw)).toBe(true);
  for(const bad of [{...raw,h:[1]}, {...raw,c:[NaN,1]}, {...raw,t:[2,1]}, {...raw,t:[1,1]}])expect(validDailyCandles(bad)).toBe(false);
 });
 it('bounds network requests and encodes imported tickers safely',async()=>{
  const request=vi.fn().mockRejectedValue(Error('offline'));expect((await readDailyCandles('A&B',request)).status).toBe('error');
  expect(request.mock.calls[0][0]).toBe('/api/candle?symbol=A%26B');expect(request.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
 });
});
