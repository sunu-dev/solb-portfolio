import { randomUUID } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { activeElapsed, aggregateUsage, kstDay, parseUsagePayload, retention, type UsageRow } from '@/lib/usageMetrics';
import { readAllRows, readAllPages } from '@/lib/readAllRows';

const sample = (overrides: Partial<UsageRow> = {}): UsageRow => ({ id: randomUUID(), session_id: 'session', user_id: 'member', visitor_id: null,
  started_at: '2026-10-11T12:00:00+09:00', ended_at: '2026-10-11T12:00:05+09:00', active_ms: 5000, feature: 'chart', event: null, ...overrides });

describe('active time and metric definitions', () => {
  it('excludes hidden, unfocused, idle and suspended intervals, including idle threshold crossing', () => {
    expect(activeElapsed(5000,10000,0,true)).toBe(5000);
    expect(activeElapsed(5000,10000,0,false)).toBe(0);
    expect(activeElapsed(58000,63000,0,true)).toBe(2000);
    expect(activeElapsed(65000,70000,0,true)).toBe(0);
    expect(activeElapsed(0,300000,0,true)).toBe(0);
  });
  it('attributes UTC day edges to the Korean date', () => {
    expect(kstDay('2026-10-10T15:00:00Z')).toBe('2026-10-11');
  });
  it('counts distinct accounts, keeps guest browsers separate, and uses per-visit duration', () => {
    const rows = [sample(), sample({ active_ms: 1000, feature: 'news' }), sample({ session_id: 'second', active_ms: 10000 }),
      sample({ user_id: null, visitor_id: 'guest', session_id: 'guest-session', active_ms: 2000 }),
      sample({ user_id: 'old', started_at: '2026-09-20T01:00:00Z', ended_at: '2026-09-20T01:00:05Z' }),
      sample({ user_id: 'zero', active_ms: 0, event: 'view' })];
    const data = aggregateUsage(rows,'2026-10-11',7);
    expect(data.members).toEqual({ dau:1, wau:1, mau:2 });
    expect(data.guests.dau).toBe(1);
    expect(data.sessions).toBe(3);
    expect(data.totalMs).toBe(18000);
    expect(data.averageMs).toBe(6000);
    expect(data.medianMs).toBe(6000);
    expect(data.visitsPerVisitor).toBe(1.5);
    expect(data.features.find(f => f.id === 'chart')?.visitors).toBe(2);
  });
  it('does not infer historic duration or an empty average', () => {
    expect(aggregateUsage([], '2026-10-11', 7)).toMatchObject({ averageMs:null, medianMs:null, exploration:{rate:null} });
  });
  it('counts only an ordered exploration path within the same visitor session', () => {
    const rows = [sample({ feature:'company', event:'view', started_at:'2026-10-11T01:00:00Z' }),
      sample({ event:'related_company', started_at:'2026-10-11T01:01:00Z' }), sample({ event:'explore_step', started_at:'2026-10-11T01:02:00Z' }),
      sample({ session_id:'other', event:'explore_step' }), sample({ session_id:'wrong-order', event:'related_company', started_at:'2026-10-11T01:00:00Z' }),
      sample({ session_id:'wrong-order', feature:'company', event:'view', started_at:'2026-10-11T01:03:00Z' })];
    expect(aggregateUsage(rows,'2026-10-11',7).exploration).toEqual({ viewed:2,related:1,continued:1,rate:50 });
  });
  it('requires signup + exact target day and excludes incomplete target-day cohorts', () => {
    const users = [ {user_id:'signup-only',created_at:'2026-10-03T03:00:00Z'}, {user_id:'returned',created_at:'2026-10-03T03:00:00Z'},
      {user_id:'wrong-day',created_at:'2026-10-03T03:00:00Z'}, {user_id:'not-complete',created_at:'2026-10-04T03:00:00Z'} ];
    const active = new Map([['2026-10-03',new Set(['signup-only'])],['2026-10-09',new Set(['wrong-day'])],['2026-10-10',new Set(['returned'])]]);
    expect(retention(users,active,'2026-10-11',7)).toEqual({eligible:3,returned:1,rate:33});
    expect(retention([],active,'2026-10-11',1).rate).toBeNull();
  });
});

describe('untrusted usage ingestion and pagination', () => {
  const now = Date.parse('2026-10-11T03:00:05Z');
  const payload = () => ({ visitorId:randomUUID(), samples:[sample({ id: randomUUID(), session_id: randomUUID() })] });
  it('retains only allowlisted timing identifiers and events; client user ID cannot set identity', () => {
    const body = payload(); Object.assign(body.samples[0], { symbol:'AAPL',user_id:'impersonated',memo:'secret',url:'/private' });
    expect(parseUsagePayload(body,now)?.samples[0]).not.toHaveProperty('user_id');
    expect(Object.keys(parseUsagePayload(body,now)!.samples[0])).toHaveLength(7);
  });
  it.each([{active_ms:6000},{active_ms:-1},{active_ms:1.2},{feature:'private'},{event:'arbitrary'},
    {started_at:'2020-01-01T00:00:00Z'},{ended_at:'2030-01-01T00:00:00Z'},{active_ms:0,event:null}])('rejects invalid sample %j', invalid => {
      const body=payload(); Object.assign(body.samples[0],invalid); expect(parseUsagePayload(body,now)).toBeNull();
    });
  it('rejects duplicate IDs and excess batches', () => {
    const body=payload(); body.samples.push(body.samples[0]); expect(parseUsagePayload(body,now)).toBeNull();
    body.samples=Array.from({length:21}, () => sample({session_id:randomUUID()})); expect(parseUsagePayload(body,now)).toBeNull();
  });
  it('requires Korean midnight intervals to be split before ingestion', () => {
    const body=payload(); Object.assign(body.samples[0], {started_at:'2026-10-10T14:59:59Z', ended_at:'2026-10-10T15:00:01Z', active_ms:2000});
    expect(parseUsagePayload(body,Date.parse('2026-10-10T15:00:02Z'))).toBeNull();
  });
  it('reads more than the default 1000 rows and propagates a failed later page', async () => {
    const rows = Array.from({length:1501},(_,id)=>({id}));
    expect((await readAllRows(after => Promise.resolve({data:rows.filter(r=>after===null || r.id>Number(after)).slice(0,1000),error:null}),r=>r.id))).toHaveLength(1501);
    expect((await readAllPages((from,to)=>Promise.resolve({data:rows.slice(from,to+1),error:null}))).data).toHaveLength(1501);
    await expect(readAllPages(from=>Promise.resolve({data:from===0 ? rows.slice(0,1000) : null,error:from ? new Error('offline'):null}))).rejects.toThrow('offline');
  });
});
