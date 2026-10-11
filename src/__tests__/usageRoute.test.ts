import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ outcome:vi.fn(), upsert:vi.fn(), limit:vi.fn(), from:vi.fn() }));
vi.mock('@/lib/adminAuth',()=>({resolveUserOutcome:mocks.outcome,isAdminIdentity:(u:{email?:string}|null)=>u?.email==='admin@test.invalid'}));
vi.mock('@/lib/rateLimiter',()=>({POLICIES:{general:{}},checkRateLimit:vi.fn(async()=>({allowed:true})),recordApiCall:vi.fn(),getClientIp:()=> 'local-test',rateLimitResponse:vi.fn()}));
vi.mock('@/lib/supabaseServer',()=>({requireServiceClient:()=>({from:mocks.from})}));
import { POST } from '@/app/api/usage/route';
import { GET } from '@/app/api/admin/usage/route';

const payload = () => ({visitorId:randomUUID(),samples:[{id:randomUUID(),session_id:randomUUID(),started_at:new Date(Date.now()-5000).toISOString(),ended_at:new Date().toISOString(),active_ms:4000,feature:'chart',event:null,user_id:'forged',memo:'private'}]});
const request = (body=payload(), headers:Record<string,string>={}) => new NextRequest('https://joobi.test/api/usage',{method:'POST',body:JSON.stringify(body),headers:{'Content-Type':'application/json',...headers}});
beforeEach(()=>{
  vi.clearAllMocks(); mocks.outcome.mockResolvedValue({status:'anonymous'}); mocks.upsert.mockResolvedValue({error:null}); mocks.limit.mockResolvedValue({error:null,count:0});
  mocks.from.mockImplementation((table:string)=>{ if(table==='usage_samples') return {upsert:mocks.upsert}; const q={select:()=>q,eq:()=>q,gte:mocks.limit};return q; });
});
describe('usage route boundaries',()=>{
  it('persists guest browser identity with idempotent writes and drops private fields',async()=>{
    const b=payload();expect((await POST(request(b))).status).toBe(204);
    expect(mocks.upsert).toHaveBeenCalledWith([expect.objectContaining({user_id:null,visitor_id:b.visitorId})],{onConflict:'id',ignoreDuplicates:true});
    expect(mocks.upsert.mock.calls[0][0][0]).not.toHaveProperty('memo');
  });
  it('uses server-authenticated account identity',async()=>{
    mocks.outcome.mockResolvedValue({status:'ok',user:{id:'verified',email:'member@test.invalid'}});
    expect((await POST(request())).status).toBe(204);
    expect(mocks.upsert.mock.calls[0][0][0]).toMatchObject({user_id:'verified',visitor_id:null});
  });
  it('excludes administrators and rejects invalid bearer tokens rather than counting guests',async()=>{
    mocks.outcome.mockResolvedValue({status:'ok',user:{id:'admin',email:'admin@test.invalid'}});expect((await POST(request())).status).toBe(204);expect(mocks.upsert).not.toHaveBeenCalled();
    mocks.outcome.mockResolvedValue({status:'anonymous'});expect((await POST(request(payload(),{Authorization:'Bearer invalid'}))).status).toBe(401);
  });
  it('fails closed on storage failure and ingestion limits',async()=>{
    mocks.limit.mockResolvedValue({error:{message:'offline'},count:null});expect((await POST(request())).status).toBe(503);
    mocks.limit.mockResolvedValue({error:null,count:30});expect((await POST(request())).status).toBe(429);expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it('blocks cross-origin telemetry and limits payload size',async()=>{
    expect((await POST(request(payload(),{Origin:'https://evil.invalid'}))).status).toBe(403);
    expect((await POST(request(payload(),{'Content-Length':'17000'}))).status).toBe(413);
  });
  it('does not mask failed persistence as successful collection',async()=>{
    mocks.upsert.mockResolvedValue({error:{message:'missing table'}});expect((await POST(request())).status).toBe(503);
  });
  it('denies guest and ordinary-user access to admin metrics before any data query',async()=>{
    const req=new NextRequest('https://joobi.test/api/admin/usage');expect((await GET(req)).status).toBe(401);
    mocks.outcome.mockResolvedValue({status:'ok',user:{id:'member',email:'member@test.invalid'}});expect((await GET(req)).status).toBe(403);expect(mocks.from).not.toHaveBeenCalled();
  });
});
