import { afterEach, expect, it, vi } from 'vitest';
import { createCoalescedRead } from '@/lib/coalescedRead';
afterEach(() => vi.useRealTimers());
it('coalesces concurrent requests and expires without extending on hits', async () => {
  vi.useFakeTimers();
  const cache = createCoalescedRead<number>(30_000);
  const load = vi.fn().mockResolvedValue(7);
  expect(await Promise.all([cache.read(1, load), cache.read(1, load)])).toEqual([7, 7]);
  await vi.advanceTimersByTimeAsync(29_999); await cache.read(1, load);
  expect(load).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1); await cache.read(1, load);
  expect(load).toHaveBeenCalledTimes(2);
});
it('does not retain failures or share different observation windows', async () => {
  const cache = createCoalescedRead<number>(30_000);
  const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(2);
  await expect(cache.read(1, load)).rejects.toThrow('offline');
  await expect(cache.read(1, load)).resolves.toBe(2);
  await cache.read(2, load);
  expect(load).toHaveBeenCalledTimes(3);
});
it('an invalidated in-flight response cannot repopulate the cache', async () => {
  const cache = createCoalescedRead<number>(30_000);
  let resolve!: (value: number) => void;
  const old = cache.read(1, () => new Promise<number>(r => { resolve = r; }));
  await Promise.resolve(); cache.clear();
  const fresh = vi.fn().mockResolvedValue(2);
  await expect(cache.read(1, fresh)).resolves.toBe(2);
  resolve(1); await old;
  await expect(cache.read(1, fresh)).resolves.toBe(2);
  expect(fresh).toHaveBeenCalledTimes(1);
});
