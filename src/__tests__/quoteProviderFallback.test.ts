vi.mock('next/server', async importOriginal => ({ ...await importOriginal<typeof import('next/server')>(), after: vi.fn() }));
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
vi.mock('@/lib/apiRoute',()=>({defineRoute:({handler}:{handler:(ctx:unknown)=>Promise<Response>})=>(req:NextRequest)=>handler({req}),POLICIES:{general:{}}}));
vi.mock('@/lib/serverLogger',()=>({logServerApi:vi.fn()}));
import {POST} from '@/app/api/quotes/route';
const yahoo=()=>Response.json({chart:{result:[{meta:{regularMarketPrice:100,regularMarketTime:1700000000,chartPreviousClose:90},timestamp:[1699900000,1700000000],indicators:{quote:[{open:[90,95],high:[95,101],low:[89,94],close:[90,100],volume:[1,2]}]}}]}});
let request:ReturnType<typeof vi.fn>;
beforeEach(()=>{vi.stubEnv('FINNHUB_API_KEY','test');request=vi.fn();vi.stubGlobal('fetch',request)});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs()});
const load=()=>POST(new NextRequest('http://localhost/api/quotes',{method:'POST',body:JSON.stringify({symbols:['TSLL']})}));
describe('US quote recovery',()=>{
 it.each([()=>new Response('{}',{status:429}),()=>Response.json({c:0}),()=>Response.json({c:-1})])('falls back when primary provider fails or returns an invalid price',async primary=>{
  request.mockImplementation((url:string)=>Promise.resolve(url.includes('finnhub')?primary():yahoo()));
  const result=await load();expect(result.status).toBe(200);expect((await result.json()).quotes.TSLL.c).toBe(100);expect(request.mock.calls.some(([url])=>String(url).includes('finance.yahoo'))).toBe(true);
 });
 it('uses the alternate provider if the primary key is unavailable',async()=>{
  vi.stubEnv('FINNHUB_API_KEY','');vi.stubEnv('NEXT_PUBLIC_FINNHUB_API_KEY','');request.mockImplementation(()=>Promise.resolve(yahoo()));
  const result=await load();expect((await result.json()).quotes.TSLL.c).toBe(100);expect(request.mock.calls.every(([url])=>!String(url).includes('finnhub'))).toBe(true);
 });
 it('does not double request a healthy primary quote',async()=>{
  request.mockResolvedValue(Response.json({c:101,d:1,dp:1}));expect((await (await load()).json()).quotes.TSLL.c).toBe(101);expect(request).toHaveBeenCalledOnce();
 });
 it('retains a missing price if both providers fail rather than inventing zero',async()=>{
  request.mockRejectedValue(Error('offline'));expect((await (await load()).json()).quotes.TSLL).toBeNull();
 });
});
