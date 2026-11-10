import { describe, expect, it, vi } from 'vitest';
import { assertPortfolioVaultHandoffAvailable, finishPortfolioVaultHandoff, registerPortfolioVaultHandoff } from '@/lib/portfolioVaultHandoff';

describe('encrypted session handoff shared by auth consumers', () => {
  it('runs one close for concurrent auth listeners and keeps completed cleanup idempotent', async () => {
    const owner = crypto.randomUUID();
    let release!: () => void;
    const close = vi.fn(() => new Promise<void>(resolve => { release = resolve; }));
    registerPortfolioVaultHandoff(owner, { close });
    const one = finishPortfolioVaultHandoff(owner), two = finishPortfolioVaultHandoff(owner);
    await Promise.resolve();
    expect(close).toHaveBeenCalledOnce();
    expect(() => assertPortfolioVaultHandoffAvailable()).toThrow();
    release();
    expect(await one).toBe(true); expect(await two).toBe(true);
    expect(await finishPortfolioVaultHandoff(owner)).toBe(true);
    expect(close).toHaveBeenCalledOnce();
    expect(() => assertPortfolioVaultHandoffAvailable()).not.toThrow();
  });
  it('retains the old session on failure, permits retry, and blocks another owner until durable', async () => {
    const owner = crypto.randomUUID();
    const close = vi.fn().mockRejectedValueOnce(new Error('quota')).mockResolvedValue(undefined);
    registerPortfolioVaultHandoff(owner, { close });
    await expect(finishPortfolioVaultHandoff(owner)).rejects.toThrow('quota');
    expect(() => registerPortfolioVaultHandoff(crypto.randomUUID(), { close: async () => {} })).toThrow();
    expect(await finishPortfolioVaultHandoff(owner)).toBe(true);
    expect(close).toHaveBeenCalledTimes(2);
  });
  it('leaves unrelated legacy owners to the existing recovery path', async () => {
    expect(await finishPortfolioVaultHandoff(crypto.randomUUID())).toBe(false);
  });
});
