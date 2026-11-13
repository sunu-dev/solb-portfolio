import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveSignupRequirements } from '@/lib/signupEligibility';
import { AGE_GATE_VERSION, TERMS_VERSION, PRIVACY_VERSION } from '@/config/legalVersions';

const read = vi.fn();
const signals: AbortSignal[] = [];
const storage = { getItem: () => null, removeItem: vi.fn() };
const rows = [
  { consent_type: 'age_18_plus', version: AGE_GATE_VERSION },
  { consent_type: 'terms', version: TERMS_VERSION },
  { consent_type: 'privacy', version: PRIVACY_VERSION },
];
const filters = vi.fn();
function client() {
  const query = { select: () => query, eq: (key: string, value: string) => { filters(key, value); return query; },
    in: () => query, abortSignal: (signal: AbortSignal) => { signals.push(signal); return read(); } };
  return { from: () => query } as unknown as SupabaseClient;
}
beforeEach(() => { vi.useFakeTimers(); read.mockReset(); filters.mockClear(); signals.length = 0; });
afterEach(() => { vi.useRealTimers(); });
it('recovers a stalled consent read with a fresh query without treating it as a new signup', async () => {
  read.mockImplementationOnce(() => new Promise(() => {})).mockResolvedValueOnce({ data: rows, error: null, status: 200 });
  const pending = resolveSignupRequirements(client(), 'owner', storage);
  await vi.advanceTimersByTimeAsync(5000);
  expect(await pending).toEqual({ status: 'eligible', missing: [] });
  expect(read).toHaveBeenCalledTimes(2); expect(signals[0].aborted).toBe(true);
  expect(signals[1]).not.toBe(signals[0]); expect(filters.mock.calls).toEqual([['user_id', 'owner'], ['user_id', 'owner']]);
});
it('bounds two stalled reads and leaves the account gate closed', async () => {
  read.mockImplementation(() => new Promise(() => {}));
  const pending = resolveSignupRequirements(client(), 'owner', storage);
  await vi.advanceTimersByTimeAsync(5500);
  expect(await pending).toEqual({ status: 'error', missing: [] });
  expect(read).toHaveBeenCalledTimes(2); expect(signals.every(signal => signal.aborted)).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});
it('checks fresh consent after a transient error and does not manufacture consent', async () => {
  read.mockResolvedValueOnce({ data: null, error: { code: '' }, status: 503 })
    .mockResolvedValueOnce({ data: [], error: null, status: 200 });
  expect((await resolveSignupRequirements(client(), 'owner', storage)).status).toBe('required');
  expect(read).toHaveBeenCalledTimes(2);
});
it('does not retry permanent failures or a cancelled caller', async () => {
  read.mockResolvedValue({ data: null, error: { code: '42501' }, status: 403 });
  expect((await resolveSignupRequirements(client(), 'owner', storage)).status).toBe('error');
  expect(read).toHaveBeenCalledOnce();
  read.mockClear(); const controller = new AbortController();
  read.mockImplementation(() => new Promise(() => {}));
  const pending = resolveSignupRequirements(client(), 'owner', storage, controller.signal);
  await vi.advanceTimersByTimeAsync(10); controller.abort();
  expect((await pending).status).toBe('error'); expect(read).toHaveBeenCalledOnce();
});
