import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
vi.mock('@/lib/rateLimiter',()=>({POLICIES:{general:{}},getClientIp:()=> 'fixture',checkRateLimit:vi.fn(),recordApiCall:vi.fn(),rateLimitResponse:vi.fn()}));
vi.mock('@/lib/serverLogger',()=>({logServerApi:vi.fn()}));
vi.mock('@/lib/marketCause/pilot',()=>({runSecShadowPilot:vi.fn()}));
import {runSecShadowPilot} from '@/lib/marketCause/pilot';
import {GET} from '@/app/api/cron/market-cause-shadow/route';
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('CRON_SECRET','synthetic-cron-secret');});
afterEach(()=>vi.unstubAllEnvs());
const request=(authorization?:string)=>new NextRequest('http://localhost/api/cron/market-cause-shadow?symbol=INTC',authorization?{headers:{authorization}}:{});
describe('shadow cron access boundary',()=>{
 it('rejects anonymous, incorrect and unset-secret requests before the worker',async()=>{
  for(const auth of [undefined,'Bearer wrong'])expect((await GET(request(auth))).status).toBe(401);
  vi.stubEnv('CRON_SECRET','');expect((await GET(request('Bearer undefined'))).status).toBe(401);expect(runSecShadowPilot).not.toHaveBeenCalled();
 });
 it('returns only private operational status, disables caching and reports unavailable processing',async()=>{
  vi.mocked(runSecShadowPilot).mockResolvedValueOnce({status:'stored',publicEligible:false});
  const response=await GET(request('Bearer synthetic-cron-secret'));expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');expect(await response.json()).toEqual({status:'stored',publicEligible:false});
  vi.mocked(runSecShadowPilot).mockResolvedValueOnce({status:'source_unavailable',publicEligible:false});
  expect((await GET(request('Bearer synthetic-cron-secret'))).status).toBe(503);
 });
});
