import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const state = vi.hoisted(() => ({ signals: [] as AbortSignal[], from: vi.fn() }));
vi.mock('@/lib/supabaseServer', () => ({
  getAuthClient: () => ({ from: state.from }),
  getServiceClient: () => ({ from: state.from }),
}));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: state.from }) }));
import { getAnalysisUsage } from '@/lib/analysisUsage';
import { checkCurrentAdultAiConsent, hasCurrentAdultAiConsent } from '@/lib/aiAgeGate';
import { getAiMonthlyBudgetStatus } from '@/lib/aiBudgetGuard';
import { getUserTier } from '@/lib/userTier';
import { checkCircuit, CIRCUIT_POLICIES } from '@/lib/circuitBreaker';
import { withAbortDeadline } from '@/lib/withAbortDeadline';

beforeEach(() => {
  vi.useFakeTimers();
  state.signals = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
  state.from.mockImplementation(() => {
    const query = {
      select: () => query, eq: () => query, or: () => query,
      gte: () => query, order: () => query, limit: () => query,
      abortSignal: (signal: AbortSignal) => { state.signals.push(signal); return query; },
      maybeSingle: () => query,
      then: () => new Promise(() => {}),
    };
    return query;
  });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });

it('fails closed on quota, consent and enabled budget timeouts and cancels their fetches', async () => {
  vi.stubEnv('AI_MONTHLY_BUDGET_USD', '100');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://db.test');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only');
  const client = { from: state.from } as unknown as SupabaseClient;
  const pending = Promise.all([getAnalysisUsage('alice'), hasCurrentAdultAiConsent(client, 'alice'), getAiMonthlyBudgetStatus()]);
  await vi.advanceTimersByTimeAsync(4500);
  const [usage, consent, budget] = await pending;
  expect(usage.available).toBe(false);
  expect(consent).toBe(false);
  expect(budget).toMatchObject({ allowed: false, reason: 'ledger_unavailable' });
  expect(state.signals).toHaveLength(7);
  expect(state.signals.every(signal => signal.aborted)).toBe(true);
});

it('identifies timed-out consent as unavailable, rather than missing', async () => {
  const pending = checkCurrentAdultAiConsent({ from: state.from } as unknown as SupabaseClient, 'alice');
  await vi.advanceTimersByTimeAsync(4500);
  expect(await pending).toEqual({ status: 'unavailable' });
  expect(state.signals[0].aborted).toBe(true);
});

it.each([
  [{ data: { id: 'current-consent' }, error: null }, 'granted'],
  [{ data: null, error: null }, 'required'],
  [{ data: null, error: { message: 'database unavailable' } }, 'unavailable'],
] as const)('distinguishes consent query result %j', async (result, status) => {
  const query = {
    select: () => query, eq: () => query, limit: () => query, abortSignal: () => query,
    maybeSingle: async () => result,
  };
  const client = { from: () => query } as unknown as SupabaseClient;
  expect(await checkCurrentAdultAiConsent(client, 'alice')).toEqual({ status });
  expect(await hasCurrentAdultAiConsent(client, 'alice')).toBe(status === 'granted');
});

it('bounds advisory circuit telemetry separately from mandatory quota checks', async () => {
  const circuit = checkCircuit('/api/ai-analysis', CIRCUIT_POLICIES.aiStrict);
  await vi.advanceTimersByTimeAsync(1000);
  expect(await circuit).toMatchObject({ open: false, stats: { total: 0 } });
  expect(state.signals[0].aborted).toBe(true);
});

it('keeps the existing free-tier fallback when membership storage stalls', async () => {
  const tier = getUserTier('alice');
  await vi.advanceTimersByTimeAsync(3000);
  expect(await tier).toBe('free');
  expect(state.signals[0].aborted).toBe(true);
});

it('clears a completed deadline without aborting a later independent request', async () => {
  let first: AbortSignal | undefined;
  expect(await withAbortDeadline(async signal => { first = signal; return 'done'; })).toBe('done');
  await vi.advanceTimersByTimeAsync(4000);
  expect(first?.aborted).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});

it('propagates caller cancellation to the pending work and removes its timer', async () => {
  const caller = new AbortController();
  let signal: AbortSignal | undefined;
  const pending = withAbortDeadline(async current => {
    signal = current;
    return new Promise(() => {});
  }, 3000, caller.signal);
  const failure = expect(pending).rejects.toThrow('caller stopped');
  await vi.advanceTimersByTimeAsync(0);
  caller.abort(new Error('caller stopped'));
  await failure;
  expect(signal?.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});
