import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }));
vi.mock('@/lib/supabaseServer', () => ({
  getAuthClient: vi.fn(),
  getServiceClient: () => ({ from: () => {
    const query = { select: () => query, eq: () => query, gte: () => query, abortSignal: m.read };
    return { ...query, insert: () => ({ abortSignal: m.write }) };
  } }),
}));
import { checkRateLimit, recordApiCall } from '@/lib/rateLimiter';
const policy = { windowSec: 60, maxAnon: 2, maxLoggedIn: 3 };
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); });
afterEach(() => vi.useRealTimers());
it('a stalled ledger cannot hang public data; concurrent admissions still obey the limit', async () => {
  m.read.mockImplementation(() => new Promise(() => {}));
  const first = checkRateLimit('stall', 'guest', false, policy);
  const second = checkRateLimit('stall', 'guest', false, policy);
  expect((await checkRateLimit('stall', 'guest', false, policy)).allowed).toBe(false);
  await vi.advanceTimersByTimeAsync(1000);
  expect((await first).allowed).toBe(true); expect((await second).allowed).toBe(true);
  expect(m.read.mock.calls.every(([signal]) => signal instanceof AbortSignal)).toBe(true);
  await vi.advanceTimersByTimeAsync(60000);
  m.read.mockResolvedValue({ count: 0, error: null });
  expect((await checkRateLimit('stall', 'guest', false, policy)).allowed).toBe(true);
});
it('a shared ledger denial remains a denial and does not consume another identity', async () => {
  m.read.mockResolvedValueOnce({ count: 2 }).mockResolvedValueOnce({ count: 0 });
  expect((await checkRateLimit('shared', 'a', false, policy)).allowed).toBe(false);
  expect((await checkRateLimit('shared', 'b', false, policy)).allowed).toBe(true);
});
it('recording cannot keep a response or background task alive indefinitely', async () => {
  m.write.mockImplementation(() => new Promise(() => {}));
  const write = recordApiCall({ endpoint: 'stall-write', userKey: 'guest', status: 200, latencyMs: 20 });
  await vi.advanceTimersByTimeAsync(1000); await expect(write).resolves.toBeUndefined();
});
