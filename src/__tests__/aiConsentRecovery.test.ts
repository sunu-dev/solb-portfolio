import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { checkCurrentAdultAiConsent } from '@/lib/aiAgeGate';
import { AGE_GATE_VERSION } from '@/config/legalVersions';
const signals: AbortSignal[] = [];
const result = vi.fn();
const filters = vi.fn();
function client() {
  const from = vi.fn(() => {
    const q = { select: () => q, eq: (key: string, value: string) => { filters(key, value); return q; }, limit: () => q,
      abortSignal: (signal: AbortSignal) => { signals.push(signal); return q; }, maybeSingle: result };
    return q;
  });
  return { value: { from } as unknown as SupabaseClient, from };
}
beforeEach(() => { vi.useFakeTimers(); result.mockReset(); filters.mockReset(); signals.length=0; vi.spyOn(console,'warn').mockImplementation(()=>{}); vi.spyOn(console,'info').mockImplementation(()=>{}); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
it('recovers one timed-out read using a fresh cancellable query and current consent filters', async () => {
  result.mockImplementationOnce(()=>new Promise(()=>{})).mockResolvedValueOnce({ data:{id:'consent'},error:null,status:200 });
  const db=client(), pending=checkCurrentAdultAiConsent(db.value,'test-owner');
  await vi.advanceTimersByTimeAsync(3000);
  expect(await pending).toEqual({status:'granted'});
  expect(db.from).toHaveBeenCalledTimes(2);expect(signals[0].aborted).toBe(true);expect(signals[1]).not.toBe(signals[0]);
  expect(filters.mock.calls.filter(([k])=>k==='version')).toEqual([['version',AGE_GATE_VERSION],['version',AGE_GATE_VERSION]]);
});
it('bounds two stalled reads to 4.5 seconds and still refuses AI access', async () => {
  result.mockImplementation(()=>new Promise(()=>{}));const db=client(),pending=checkCurrentAdultAiConsent(db.value,'test-owner');
  await vi.advanceTimersByTimeAsync(4500);expect(await pending).toEqual({status:'unavailable'});
  expect(db.from).toHaveBeenCalledTimes(2);expect(signals.every(s=>s.aborted)).toBe(true);expect(vi.getTimerCount()).toBe(0);
});
it('rechecks a transient gateway failure but does not turn an absent consent into a grant', async () => {
  result.mockResolvedValueOnce({data:null,error:{code:'',message:'private payload'},status:503}).mockResolvedValueOnce({data:null,error:null,status:200});
  const db=client();expect(await checkCurrentAdultAiConsent(db.value,'test-owner')).toEqual({status:'required'});
  expect(db.from).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toMatch(/test-owner|private payload/);
});
it('does not retry permission or schema errors', async () => {
  for(const code of ['42501','42P01']) {
    result.mockResolvedValue({data:null,error:{code},status:403});const db=client();
    expect(await checkCurrentAdultAiConsent(db.value,'test-owner')).toEqual({status:'unavailable'});expect(db.from).toHaveBeenCalledOnce();
  }
});
it('never caches a grant across requests or accounts', async () => {
  result.mockResolvedValueOnce({data:{id:'consent'},error:null,status:200}).mockResolvedValue({data:null,error:null,status:200});const db=client();
  expect(await checkCurrentAdultAiConsent(db.value,'alice')).toEqual({status:'granted'});
  expect(await checkCurrentAdultAiConsent(db.value,'alice')).toEqual({status:'required'});
  expect(await checkCurrentAdultAiConsent(db.value,'bob')).toEqual({status:'required'});
});
