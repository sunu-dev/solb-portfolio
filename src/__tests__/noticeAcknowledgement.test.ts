import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { acknowledgeNotice, isNoticeAcknowledged, NOTICE_ACK_KEY, subscribeNoticeAcknowledgement } from '@/lib/noticeAcknowledgement';

let values: Map<string, string>;
beforeEach(() => {
  values = new Map();
  vi.stubGlobal('window', Object.assign(new EventTarget(), { localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  } }));
});
afterEach(() => vi.unstubAllGlobals());
it('remembers the specific change across entries, without suppressing the next clock change', () => {
  const changed = vi.fn(); const unsubscribe = subscribeNoticeAcknowledgement(changed);
  expect(isNoticeAcknowledged('us-clock-2026-end')).toBe(false);
  expect(acknowledgeNotice('us-clock-2026-end')).toBe(true);
  expect(isNoticeAcknowledged('us-clock-2026-end')).toBe(true);
  expect(isNoticeAcknowledged('us-clock-2027-start')).toBe(false);
  expect(changed).toHaveBeenCalledOnce(); unsubscribe();
  expect(JSON.parse(values.get(NOTICE_ACK_KEY)!)).toEqual(['us-clock-2026-end']);
});
it('ignores corrupt preferences and does not claim a failed save succeeded', () => {
  values.set(NOTICE_ACK_KEY, '{broken'); expect(isNoticeAcknowledged('us-clock-2026-end')).toBe(false);
  vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('storage disabled'); });
  expect(acknowledgeNotice('us-clock-2026-end')).toBe(false);
  expect(isNoticeAcknowledged('us-clock-2026-end')).toBe(false);
});
it('updates other tabs when preferences change or are cleared', () => {
  const changed = vi.fn(); const unsubscribe = subscribeNoticeAcknowledgement(changed);
  const event = Object.assign(new Event('storage'), { key: NOTICE_ACK_KEY });
  window.dispatchEvent(event); expect(changed).toHaveBeenCalledOnce();
  window.dispatchEvent(Object.assign(new Event('storage'), { key: null }));
  expect(changed).toHaveBeenCalledTimes(2); unsubscribe();
  window.dispatchEvent(event); expect(changed).toHaveBeenCalledTimes(2);
});
