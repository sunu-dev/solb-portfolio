import { afterEach, expect, it, vi } from 'vitest';
import { privateNotificationsPaused } from '@/lib/privateNotificationPause';
afterEach(() => vi.unstubAllEnvs());
it.each([undefined, 'off'])('retains legacy notification behavior for %s', setting => {
  vi.stubEnv('PORTFOLIO_PRIVATE_NOTIFICATIONS_PAUSED', setting);
  expect(privateNotificationsPaused()).toBe(false);
});
it.each(['on', '', 'true', 'misspelled'])('pauses conservatively for configured value %s', setting => {
  vi.stubEnv('PORTFOLIO_PRIVATE_NOTIFICATIONS_PAUSED', setting);
  expect(privateNotificationsPaused()).toBe(true);
});
