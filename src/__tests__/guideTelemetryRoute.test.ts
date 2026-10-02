import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  from: vi.fn(), count: vi.fn(), insertEvent: vi.fn(), record: vi.fn(), getUser: vi.fn(),
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mocks.from, auth: { getUser: mocks.getUser } }),
}));
vi.mock('@/lib/rateLimiter', () => ({ getClientIp: () => '127.0.0.1' }));

let POST: (request: NextRequest) => Promise<Response>;
beforeAll(async () => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.invalid');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only');
  ({ POST } = await import('@/app/api/tour-event/route'));
});
afterAll(() => vi.unstubAllEnvs());
beforeEach(() => {
  vi.clearAllMocks();
  mocks.count.mockResolvedValue({ count: 0, error: null });
  mocks.insertEvent.mockResolvedValue({ error: null });
  mocks.record.mockResolvedValue({ error: null });
  mocks.from.mockImplementation((table: string) => {
    if (table === 'tour_events') return { insert: mocks.insertEvent };
    const query = { select: () => query, eq: () => query, gte: mocks.count, insert: mocks.record };
    return query;
  });
});

function request(event: string, meta: unknown) {
  return new NextRequest('https://joobi.test/api/tour-event', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, anonId: 'test-guest-id', meta }),
  });
}

describe('guest guide event ingestion', () => {
  it('persists the boolean false answer and removes private explanation and holding fields', async () => {
    const response = await POST(request('guide_check', {
      guideId: 'inflation', correct: false, text: 'private explanation', symbol: 'AAPL', shares: 5, from: 'private context',
    }));
    expect(response.status).toBe(204);
    expect(mocks.insertEvent).toHaveBeenCalledWith({
      anon_id: 'test-guest-id', user_id: null, event: 'guide_check', auth_state: 'guest',
      meta: { guideId: 'inflation', correct: false },
    });
  });

  it.each(['guide_open', 'guide_save'])('retains only guideId for %s', async event => {
    const response = await POST(request(event, { guideId: 'earnings', correct: true, text: 'private' }));
    expect(response.status).toBe(204);
    expect(mocks.insertEvent.mock.calls[0][0].meta).toEqual({ guideId: 'earnings' });
  });

  it.each([
    ['guide_open', { guideId: 'AAPL' }],
    ['guide_open', { guideId: 'coffee' }],
    ['guide_save', { guideId: 'my written explanation' }],
    ['guide_check', { guideId: 'rates' }],
    ['guide_check', { guideId: 'rates', correct: 'false' }],
    ['guide_check', { guideId: 'rates', correct: 0 }],
    ['guide_open', null],
  ])('rejects invalid guide metadata for %s', async (event, meta) => {
    expect((await POST(request(event, meta))).status).toBe(400);
    expect(mocks.insertEvent).not.toHaveBeenCalled();
    expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({ error_code: 'invalid_guide_meta' }));
  });

  it('preserves existing tour metadata validation', async () => {
    const response = await POST(request('tour_step', { featureId: 'search', step: 2, text: 'private', correct: true }));
    expect(response.status).toBe(204);
    expect(mocks.insertEvent.mock.calls[0][0].meta).toEqual({ featureId: 'search', step: 2 });
  });

  it('retains the existing rate limit for guide events', async () => {
    mocks.count.mockResolvedValue({ count: 30, error: null });
    expect((await POST(request('guide_open', { guideId: 'rates' }))).status).toBe(429);
    expect(mocks.insertEvent).not.toHaveBeenCalled();
  });
});
