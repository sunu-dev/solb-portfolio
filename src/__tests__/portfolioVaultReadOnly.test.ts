import { expect, it, vi } from 'vitest';
import { PortfolioVaultRuntime } from '@/lib/portfolioVaultRuntime';
import type { PortfolioVaultPayload } from '@/lib/portfolioVaultPayload';

it('read-only runtime preserves pending records without scheduling cloud writes or conflict resolution', async () => {
  vi.useFakeTimers();
  try {
    const payload: PortfolioVaultPayload = { stocks: { investing: [], watching: [], sold: [] }, snapshots: [], history: [],
      privateState: { customEvents: [], recentSymbols: [], lastImportCheckpoint: null, investorType: 'diversified', investorTypeSetAt: null } };
    const controller = { open: vi.fn(), lock: vi.fn(), edit: vi.fn(), flush: vi.fn(), resolveConflict: vi.fn(),
      getSnapshot: () => ({ status: 'pending' as const, payload }), subscribe: () => () => {} };
    let change = () => {};
    const store = { read: () => ({ ownerId: 'synthetic-owner', payload }),
      subscribe: (listener: () => void) => { change = listener; return () => {}; },
      apply: vi.fn(), status: vi.fn(), clear: vi.fn() };
    const runtime = new PortfolioVaultRuntime('synthetic-owner', controller, store, 2_000, true);
    await runtime.open();
    change();
    await vi.advanceTimersByTimeAsync(10_000);
    await runtime.flush();
    await expect(runtime.resolveConflict('remote')).rejects.toMatchObject({ code: 'read_only' });
    await runtime.close();
    expect(store.apply).toHaveBeenCalled();
    expect(controller.flush).not.toHaveBeenCalled();
    expect(controller.edit).not.toHaveBeenCalled();
    expect(controller.resolveConflict).not.toHaveBeenCalled();
    expect(controller.lock).toHaveBeenCalledOnce();
  } finally { vi.useRealTimers(); }
});
