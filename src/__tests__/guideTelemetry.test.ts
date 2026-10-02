import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ session: vi.fn(), logApiCall: vi.fn(), fetch: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: mocks.session } } }));
vi.mock('@/lib/apiLogger', () => ({ logApiCall: mocks.logApiCall }));

import { logGuideEvent, logTourEvent } from '@/lib/tourTelemetry';
import type { GuideAction } from '@/lib/tourEvents';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('localStorage', { getItem: () => 'test-guest-id', setItem: vi.fn() });
  vi.stubGlobal('fetch', mocks.fetch.mockResolvedValue({ ok: true }));
  mocks.session.mockResolvedValue({ data: { session: null } });
});
afterEach(() => vi.unstubAllGlobals());

describe('market guide telemetry', () => {
  it('records repeated opens rather than treating learning as a one-time feature adoption', async () => {
    logGuideEvent('open', 'rates');
    logGuideEvent('open', 'rates');
    await vi.waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2));
    for (const [url, options] of mocks.fetch.mock.calls) {
      expect(url).toBe('/api/tour-event');
      expect(options).toMatchObject({ method: 'POST', keepalive: true });
      expect(JSON.parse(options.body)).toEqual({
        event: 'guide_open', anonId: 'test-guest-id', meta: { guideId: 'rates' },
      });
    }
  });

  it('records a false check outcome for signed-in users with no holding or free-text metadata', async () => {
    mocks.session.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
    logGuideEvent('check', 'rates', false);
    await vi.waitFor(() => expect(mocks.logApiCall).toHaveBeenCalledWith(
      'guide_check', undefined, { guideId: 'rates', correct: false }, 'user-1',
    ));
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it.each(['rates', 'inflation', 'currency', 'earnings'])('accepts the supported guide %s', async guideId => {
    logGuideEvent('save', guideId);
    await vi.waitFor(() => expect(mocks.fetch).toHaveBeenCalledOnce());
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body).meta).toEqual({ guideId });
  });

  it('drops unknown guides/actions and a check with no boolean answer before reading the session', () => {
    logGuideEvent('open', 'AAPL');
    logGuideEvent('open', 'coffee');
    logGuideEvent('save', 'my private explanation');
    logGuideEvent('check', 'rates');
    logGuideEvent('check', 'rates', 'false' as unknown as boolean);
    logGuideEvent('toString' as GuideAction, 'rates');
    expect(mocks.session).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('applies guide metadata restrictions even when the generic logger is called directly', async () => {
    await logTourEvent('guide_save', { guideId: 'currency', correct: true, text: 'private text', symbol: 'AAPL', shares: 5 });
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body).meta).toEqual({ guideId: 'currency' });
  });

  it('does not interrupt the guide when session lookup fails', async () => {
    mocks.session.mockRejectedValue(new Error('offline'));
    await expect(logTourEvent('guide_open', { guideId: 'rates' })).resolves.toBeUndefined();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
