import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { boundedFetch } from '@/lib/boundedFetch';
import { loadQuoteBatch } from '@/lib/quoteClient';

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it('bounds a stalled response body and aborts the underlying request', async () => {
  let signal: AbortSignal | undefined;
  vi.stubGlobal('fetch', vi.fn((_url, init) => {
    signal = init.signal;
    return Promise.resolve({ ok: true, json: () => new Promise(() => {}) });
  }));
  const outcome = boundedFetch('https://source.test', 1000, r => r.json()).catch(error => error.message);
  await vi.advanceTimersByTimeAsync(1000);
  expect(await outcome).toBe('Request deadline exceeded'); expect(signal?.aborted).toBe(true);
});
it('shares simultaneous price refreshes but retries after a failure', async () => {
  let finish!: (value: Response) => void;
  const request = vi.fn(() => new Promise<Response>(resolve => { finish = resolve; }));
  vi.stubGlobal('fetch', request);
  const first = loadQuoteBatch(['NVDA', 'AAPL'], true);
  const second = loadQuoteBatch(['AAPL', 'NVDA', 'AAPL'], true);
  expect(first).toBe(second); expect(request).toHaveBeenCalledOnce();
  const outcomes = Promise.allSettled([first, second]); finish(new Response('{}', { status: 503 }));
  expect((await outcomes).every(r => r.status === 'rejected')).toBe(true);
  const retry = loadQuoteBatch(['AAPL', 'NVDA'], true);
  finish(Response.json({ quotes: { AAPL: { c: 100 } } }));
  expect((await retry).quotes?.AAPL?.c).toBe(100); expect(request).toHaveBeenCalledTimes(2);
});
