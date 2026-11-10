import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createNarrativeModel } from '@/lib/marketCause/narrativeModel';
// Exercise the installed SDK, not a mocked GoogleGenAI class. No real network.
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
describe('installed SDK single-attempt transport', () => {
  it.each([[400, 'invalid_request'], [429, 'rate_limited'], [503, 'provider_unavailable']] as const)(
    'retains HTTP %i with an empty reason phrase and never retries generation', async (status, failure) => {
      vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-31T07:00:00Z'));
      const network = vi.spyOn(globalThis, 'fetch').mockImplementation(async (request) => {
        const url = String(request);
        expect(url.startsWith('https://generativelanguage.googleapis.com/')).toBe(true);
        if (url.includes(':countTokens')) return new Response(JSON.stringify({ totalTokens: 100 }), { status: 200 });
        return new Response(JSON.stringify({ error: { code: status, message: 'Do not expose this provider body', status: 'FIXTURE_ERROR' } }), { status, statusText: '' });
      });
      const settle = vi.fn(async () => true);
      const model = createNarrativeModel('synthetic-key', { reserve: async () => ({ status: 'reserved', token: randomUUID() }), settle });
      await expect(model.generate('transport:draft', 'public evidence')).rejects.toThrow(`narrative_unsettled_call_uncertain_${failure}`);
      expect(network.mock.calls.filter(([url]) => String(url).includes(':generateContent'))).toHaveLength(1);
      expect(settle).not.toHaveBeenCalled();
      expect(model.diagnostics?.()).toMatchObject([{ failure, tokenCounted: true }]);
      expect(JSON.stringify(model.diagnostics?.())).not.toContain('provider body');
    },
  );
});
