import { expect, it } from 'vitest';
import { assistantSessionSelection } from '@/lib/assistantSession';

it.each([
  ['2026-11-06T02:00:00Z', '2026-11-05'], // KST morning, US just closed
  ['2026-11-06T16:00:00Z', '2026-11-05'], // next US session is open
  ['2026-11-06T22:00:00Z', '2026-11-06'],
  ['2026-11-08T18:00:00Z', '2026-11-06'], // weekend
  ['2026-11-26T18:00:00Z', '2026-11-25'], // Thanksgiving holiday
  ['2026-11-27T17:59:00Z', '2026-11-25'], // early close, still open
  ['2026-11-27T18:01:00Z', '2026-11-27'], // 13:00 ET early close
  ['2026-03-09T14:00:00Z', '2026-03-06'], // after DST weekend, new session open
])('uses the last completed US session at %s without inventing a trading day', (time, day) => {
  expect(assistantSessionSelection('MU', 'previous', Date.parse(time))).toEqual({ reference: 'previous', throughDay: day, description: '최근 마감한 미국 정규장' });
});

it('excludes today for Korean yesterday and leaves actual trading-day selection to the daily bars', () => {
  expect(assistantSessionSelection('005930.KS', 'previous', Date.parse('2026-11-06T08:00:00Z'))?.throughDay).toBe('2026-11-05');
  expect(assistantSessionSelection('^KS11', 'previous', Date.parse('2026-11-09T01:00:00Z'))?.throughDay).toBe('2026-11-08');
});

it('does not turn unknown calendar years into a guessed session', () => {
  expect(assistantSessionSelection('MU', 'previous', Date.parse('2030-11-06T16:00:00Z'))).toBeUndefined();
  expect(assistantSessionSelection('MU', 'latest', Date.parse('2026-11-06T16:00:00Z'))).toBeUndefined();
});
