import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
import { BLS_RELEASE_SCHEDULES, parseBlsReleaseSchedule, parseCalendarIcs } from '@/lib/economicSources';
import { readEconomicSchedule } from '@/lib/economicFeed';

const table = (period = 'October 2026', date = 'Nov. 06, 2026', time = '08:30 AM') => `
  <table class="release-list"><thead><tr><th>Reference Month</th><th>Release Date</th><th>Release Time</th></tr></thead>
  <tbody><tr><td>${period}</td><td>${date}</td><td>${time}</td></tr></tbody></table>`;
afterEach(() => vi.unstubAllGlobals());

describe('BLS reference periods and official release tables', () => {
  it('reads the stated observation month and converts the release across the year and daylight saving boundaries', () => {
    expect(parseBlsReleaseSchedule(table(), 'jobs')[0]).toMatchObject({
      key: 'jobs:2026-10', period: '2026-10', at: '2026-11-06T13:30:00.000Z',
      sourceUrl: BLS_RELEASE_SCHEDULES.jobs,
    });
    expect(parseBlsReleaseSchedule(table('December 2026', 'Jan. 08, 2027'), 'jobs')[0]?.at).toBe('2027-01-08T13:30:00.000Z');
    expect(parseBlsReleaseSchedule(table('June 2027', 'Jul. 14, 2027'), 'cpi')[0]?.at).toBe('2027-07-14T12:30:00.000Z');
  });
  it('does not invent reference months missing from the subscription calendar', () => {
    const ics = 'BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART;TZID=US-Eastern:20261106T083000\nSUMMARY:Employment Situation\nEND:VEVENT\nEND:VCALENDAR';
    expect(parseCalendarIcs(ics, 'bls')).toEqual([]);
  });
  it.each([
    table('October 2026', 'Feb. 30, 2027'), table('October 2026', 'Nov. 32, 2026'),
    table('October 2026', 'Nov. 06, 2026', '25:30 AM'), table('October 2026', 'Nov. 06, 2026', '08:61 AM'),
    table('Not a period', 'Nov. 06, 2026'), table().replace('Reference Month', 'Previous Month'),
    '<html>Access denied</html>',
  ])('rejects incomplete or invalid release evidence', html => {
    expect(parseBlsReleaseSchedule(html, 'cpi')).toEqual([]);
  });
  it('loads both official product schedules without relying on the incomplete ICS feed', async () => {
    const request = vi.fn(async (url: string) => new Response(url === BLS_RELEASE_SCHEDULES.cpi
      ? table('October 2026', 'Nov. 10, 2026') : table()));
    vi.stubGlobal('fetch', request);
    const events = await readEconomicSchedule('bls');
    expect(events.map(event => event.key)).toEqual(['cpi:2026-10', 'jobs:2026-10']);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls.map(([url]) => url)).toEqual(Object.values(BLS_RELEASE_SCHEDULES));
  });
  it('preserves failed status when either product schedule is blocked or has no dated table', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url === BLS_RELEASE_SCHEDULES.cpi
      ? new Response(table()) : new Response('denied', { status: 403 })));
    await expect(readEconomicSchedule('bls')).rejects.toThrow('403');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>not a schedule</html>')));
    await expect(readEconomicSchedule('bls')).rejects.toThrow('empty BLS');
  });
});
