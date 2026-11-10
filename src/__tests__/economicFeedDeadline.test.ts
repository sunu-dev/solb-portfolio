import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
import { getEconomicFeed } from '@/lib/economicFeed';
import { BLS_RELEASE_SCHEDULES } from '@/lib/economicSources';
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-06T00:00:00Z')); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it('returns confirmed schedules even when all other sources and observations stall', async () => {
  const table = '<table class="release-list"><tr><th>Reference Month</th><th>Release Date</th><th>Release Time</th></tr><tr><td>October 2026</td><td>Nov. 10, 2026</td><td>08:30 AM</td></tr></table>';
  vi.stubGlobal('fetch', vi.fn((url: string) => Object.values(BLS_RELEASE_SCHEDULES).includes(url)
    ? Promise.resolve(new Response(table)) : new Promise(() => {})));
  const pending = getEconomicFeed();
  await vi.advanceTimersByTimeAsync(5500);
  const feed = await pending;
  expect(feed.events.some(event => event.key === 'cpi:2026-10' && event.at === '2026-11-10T13:30:00.000Z')).toBe(true);
  expect(feed.warnings).toContain('일부 발표 수치를 확인하지 못했어요. 미확인 결과는 브리핑에 넣지 않아요.');
  expect(feed.warnings.some(warning => warning.includes('2026-09-19'))).toBe(true);
  expect(feed.events.find(event => event.key === 'cpi:2026-10')?.result).toBeUndefined();
});
