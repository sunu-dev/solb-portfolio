import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePortfolioStore } from '@/store/portfolioStore';
import { portfolioVaultStorePort } from '@/lib/portfolioVaultStore';
import { markProtectedPortfolioOwner } from '@/lib/portfolioVaultPolicy';
import { portfolioWriteBlockReason } from '@/lib/portfolioWriteAccess';
import type { PortfolioVaultPayload } from '@/lib/portfolioVaultPayload';

const owner = 'synthetic-store-owner';
const original = usePortfolioStore.getState();
let rows: Map<string, string>;
const payload: PortfolioVaultPayload = { stocks: { investing: [{ symbol: 'PRIVATE_STORE_TEST', shares: 3,
  avgCost: 42.5, targetReturn: 10 }], watching: [], sold: [] }, snapshots: [], history: [],
privateState: { recentSymbols: ['PRIVATE_STORE_TEST'], customEvents: [], lastImportCheckpoint: null,
  investorType: 'growth', investorTypeSetAt: null } };

beforeEach(() => {
  rows = new Map();
  const storage = { getItem: (key: string) => rows.get(key) ?? null,
    setItem: (key: string, value: string) => { rows.set(key, value); }, removeItem: (key: string) => rows.delete(key) };
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', { localStorage: storage, dispatchEvent: vi.fn() });
  markProtectedPortfolioOwner(owner, storage);
  usePortfolioStore.setState({ portfolioOwnerId: owner });
});
afterEach(() => { usePortfolioStore.setState(original); vi.unstubAllGlobals(); });

describe('real Zustand encrypted runtime adapter', () => {
  it('applies complete personal state without persisting plaintext or sharing mutable controller references', () => {
    portfolioVaultStorePort.apply(owner, payload);
    const read = portfolioVaultStorePort.read();
    expect(read.payload).toEqual(payload);
    expect(read.payload.stocks).not.toBe(payload.stocks);
    expect(read.payload.privateState?.recentSymbols).not.toBe(payload.privateState?.recentSymbols);
    expect(rows.has('solb-portfolio-storage')).toBe(false);
    expect([...rows.values()].join('')).not.toContain('PRIVATE_STORE_TEST');
    expect([...rows.values()].join('')).not.toContain('42.5');
  });
  it('distinguishes local encryption in progress from a confirmed cloud save', () => {
    portfolioVaultStorePort.status(owner, { status: 'ready', localPending: true, localError: false, closing: false });
    expect(usePortfolioStore.getState().portfolioSyncStatus).toBe('saving');
    portfolioVaultStorePort.status(owner, { status: 'ready', localPending: false, localError: false, closing: false });
    expect(usePortfolioStore.getState().portfolioSyncStatus).toBe('synced');
    portfolioVaultStorePort.status(owner, { status: 'ready', localPending: true, localError: true, closing: true });
    expect(usePortfolioStore.getState().portfolioSyncStatus).toBe('storage-error');
    expect(portfolioWriteBlockReason(usePortfolioStore.getState())).not.toBeNull();
  });
  it('clears only the outgoing owner and rejects stale applies across account changes', () => {
    portfolioVaultStorePort.apply(owner, payload);
    portfolioVaultStorePort.clear('unrelated-owner');
    expect(usePortfolioStore.getState().stocks.investing).toHaveLength(1);
    portfolioVaultStorePort.clear(owner);
    expect(usePortfolioStore.getState().portfolioOwnerId).toBeNull();
    expect(usePortfolioStore.getState().stocks.investing).toEqual([]);
    expect(usePortfolioStore.getState().portfolioProtectionStatus).toBe('locked');
    expect(() => portfolioVaultStorePort.apply(owner, payload)).toThrow();
    expect([...rows.values()].join('')).not.toContain('PRIVATE_STORE_TEST');
  });
});
