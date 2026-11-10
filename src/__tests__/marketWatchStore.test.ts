import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), collect: vi.fn(), response: undefined as unknown }));
vi.mock('@/lib/supabaseServer', () => ({ requireServiceClient: () => ({ rpc: mocks.rpc, from: mocks.from }) }));
vi.mock('@/lib/cronAlert', () => ({ sendCronAlert: vi.fn() }));
vi.mock('@/lib/marketWatchCollector', () => ({ collectMarketWatch: mocks.collect }));
import { readMarketWatch, refreshMarketWatch } from '@/lib/marketWatchStore';

beforeEach(() => { vi.clearAllMocks(); });
describe('shared publication store', () => {
  it('public reads never collect or regenerate market content', async () => {
    const builder = { gte: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue({ data: [], error: null }) };
    mocks.from.mockImplementation((table: string) => ({ select: () => table === 'market_watch_events' ? builder
      : Promise.resolve({ data: [{ scope: 'market', last_run: { scope: 'market', checkedAt: '2026-10-15T03:00:00Z', coverage: [], warnings: [] }, last_error: 'failed' }], error: null }) }));
    const feed = await readMarketWatch();
    expect(mocks.collect).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
    expect(feed.runs[0].warnings[0]).toContain('마지막 확인 기록');
  });
  it('does not start a second collection when another instance holds the lease', async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    expect(await refreshMarketWatch('market')).toMatchObject({ skipped: true });
    expect(mocks.collect).not.toHaveBeenCalled(); expect(mocks.from).not.toHaveBeenCalled();
  });
  it('preserves prior publication and releases its lease on total source failure', async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [], error: null }), maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) });
    mocks.collect.mockResolvedValue({ candidates: [], coverage: [{ id: 'krx', available: 0, total: 1 }], warnings: ['failed'] });
    await expect(refreshMarketWatch('market')).rejects.toThrow('All market watch sources unavailable');
    expect(mocks.rpc.mock.calls[1][0]).toBe('publish_market_watch');
    expect(mocks.rpc.mock.calls[1][1]).toMatchObject({ p_error: 'collection_failed', p_events: [], p_run: null });
  });
  it('publishes source coverage and events together, without holding-level data', async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [], error: null }), maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) });
    mocks.collect.mockResolvedValue({ candidates: [], coverage: [{ id: 'industry-news', available: 42, total: 42 }], warnings: [] });
    const result = await refreshMarketWatch('industries');
    expect(result).toMatchObject({ skipped: false, count: 0 });
    expect(mocks.rpc.mock.calls[1][1]).toMatchObject({ p_scope: 'industries', p_events: [], p_run: { coverage: [{ available: 42, total: 42 }] } });
  });
});
