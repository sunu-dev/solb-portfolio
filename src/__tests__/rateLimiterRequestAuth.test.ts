import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const getUser = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabaseServer', () => ({ getAuthClient: () => ({ auth: { getUser } }) }));
import { getAuthOutcome, getUserIdFromAuth } from '@/lib/rateLimiter';
beforeEach(() => { getUser.mockReset(); });
afterEach(() => vi.useRealTimers());

it('ends stalled authentication without accepting an identity or re-verifying the same request', async () => {
  vi.useFakeTimers();
  getUser.mockClear().mockImplementation(() => new Promise(() => {}));
  const request = new NextRequest('https://joobi.test', { headers: { authorization: 'Bearer stalled' } });
  const pending = Promise.all([getUserIdFromAuth(request), getUserIdFromAuth(request)]);
  await vi.advanceTimersByTimeAsync(5000);
  expect(await pending).toEqual([null, null]);
  expect(await getUserIdFromAuth(request)).toBeNull();
  expect(await getAuthOutcome(request)).toEqual({ status: 'unavailable' });
  expect(getUser).toHaveBeenCalledTimes(1);
});

it.each([
  [{ status: 401 }, 'unauthorized'],
  [{ status: 403 }, 'unauthorized'],
  [{ status: 400, code: 'bad_jwt' }, 'unauthorized'],
  [{ status: 503 }, 'unavailable'],
  [{ status: 429 }, 'unavailable'],
  [{ status: 0, name: 'AuthRetryableFetchError' }, 'unavailable'],
] as const)('separates an auth error %j from a missing login', async (error, status) => {
  getUser.mockResolvedValue({ data: { user: null }, error });
  const request = new NextRequest('https://joobi.test', { headers: { authorization: 'Bearer tested' } });
  expect(await getAuthOutcome(request)).toEqual({ status });
  expect(await getUserIdFromAuth(request)).toBeNull();
  expect(getUser).toHaveBeenCalledTimes(1);
});

it('classifies a missing token without querying authentication', async () => {
  expect(await getAuthOutcome(new NextRequest('https://joobi.test'))).toEqual({ status: 'unauthorized' });
  expect(getUser).not.toHaveBeenCalled();
});

it('does not start a verification after the caller has already cancelled', async () => {
  const controller = new AbortController();
  controller.abort();
  const request = new NextRequest('https://joobi.test', { signal: controller.signal, headers: { authorization: 'Bearer cancelled' } });
  expect(await getUserIdFromAuth(request)).toBeNull();
  expect(getUser).not.toHaveBeenCalled();
});

it('shares in-flight verification within one request without sharing identities across requests', async () => {
  getUser.mockResolvedValueOnce({ data: { user: { id: 'alice' } } }).mockResolvedValueOnce({ data: { user: { id: 'bob' } } });
  const request = new NextRequest('https://joobi.test', { headers: { authorization: 'Bearer first' } });
  expect(await Promise.all([getUserIdFromAuth(request), getUserIdFromAuth(request)])).toEqual(['alice', 'alice']);
  expect(getUser).toHaveBeenCalledTimes(1);
  expect(await getUserIdFromAuth(new NextRequest('https://joobi.test', { headers: { authorization: 'Bearer second' } }))).toBe('bob');
  expect(getUser).toHaveBeenCalledTimes(2);
});

it('does not turn a missing or rejected token into a logged-in identity', async () => {
  getUser.mockClear().mockRejectedValueOnce(new Error('unavailable'));
  expect(await getUserIdFromAuth(new NextRequest('https://joobi.test'))).toBeNull();
  expect(getUser).not.toHaveBeenCalled();
  const request = new NextRequest('https://joobi.test', { headers: { authorization: 'Bearer invalid' } });
  expect(await Promise.all([getUserIdFromAuth(request), getUserIdFromAuth(request)])).toEqual([null, null]);
  expect(getUser).toHaveBeenCalledTimes(1);
});
