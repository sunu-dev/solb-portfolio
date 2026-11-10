import { describe, expect, it } from 'vitest';
import { allowLegacyPortfolioWrite, isProtectedPortfolioOwner, markProtectedPortfolioOwner, PORTFOLIO_UI_PREFERENCES_KEY,
  readPortfolioWithUiPreferences, routeProtectedPortfolioPersistence } from '@/lib/portfolioVaultPolicy';
import { preparePortfolioIdentity, preserveUnsyncedPortfolio } from '@/lib/portfolioIdentity';
import { rebasePortfolioSyncOutbox, writePortfolioSyncOutbox } from '@/lib/portfolioSyncOutbox';

function storage() {
  const rows = new Map<string, string>();
  return { rows, get length() { return rows.size; }, key: (index: number) => [...rows.keys()][index] ?? null,
    getItem: (key: string) => rows.get(key) ?? null, setItem: (key: string, value: string) => { rows.set(key, value); },
    removeItem: (key: string) => { rows.delete(key); }, clear: () => rows.clear() };
}
const original = JSON.stringify({ version: 3, state: { portfolioOwnerId: 'synthetic-owner',
  stocks: { investing: [{ symbol: 'PRIVATE_TEST', shares: 3, notes: 'private note' }] },
  dailySnapshots: ['private snapshot'], portfolioImportHistory: ['private checkpoint'],
  customEvents: ['private plan'], recentSymbols: ['PRIVATE_TEST'], investorType: 'growth',
  darkMode: true, autoRefresh: true, currency: 'KRW', refreshInterval: 60_000 } });

describe('portfolio persistence protection boundary', () => {
  it('retains the original source but writes only neutral preferences in secure reader mode', () => {
    const store = storage(); store.setItem('solb-portfolio-storage', original);
    expect(routeProtectedPortfolioPersistence(original, store, true)).toBe(true);
    expect(store.getItem('solb-portfolio-storage')).toBe(original);
    expect(JSON.parse(store.getItem(PORTFOLIO_UI_PREFERENCES_KEY)!)).toEqual({
      darkMode: true, autoRefresh: true, currency: 'KRW', refreshInterval: 60_000,
    });
  });
  it('keeps a previously protected owner protected even when the build flag is off', () => {
    const store = storage();
    expect(isProtectedPortfolioOwner('synthetic-owner', store)).toBe(false);
    markProtectedPortfolioOwner('synthetic-owner', store);
    expect(routeProtectedPortfolioPersistence(original, store, false)).toBe(true);
    expect(isProtectedPortfolioOwner('synthetic-owner', store)).toBe(true);
  });
  it('does not alter an unprotected legacy account before rollout', () => {
    const store = storage();
    expect(routeProtectedPortfolioPersistence(original, store, false)).toBe(false);
    expect(store.rows.size).toBe(0);
  });
  it('keeps plaintext persistence disabled through logout, owner reset and a reader flag rollback', () => {
    const store = storage();
    markProtectedPortfolioOwner('synthetic-owner', store);
    const cleared = JSON.stringify({ version: 3, state: { portfolioOwnerId: null, stocks: {}, darkMode: false } });
    expect(routeProtectedPortfolioPersistence(cleared, store, false)).toBe(true);
    expect(allowLegacyPortfolioWrite(null, store, false)).toBe(false);
    expect(allowLegacyPortfolioWrite('another-owner', store, false)).toBe(false);
  });
  it('fails closed if storage cannot verify the protection marker', () => {
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => {} };
    expect(() => routeProtectedPortfolioPersistence(original, blocked, false)).toThrow();
    expect(() => markProtectedPortfolioOwner('synthetic-owner', blocked)).toThrow();
  });
  it('blocks old outbox and recovery writers before they can copy protected records', () => {
    const store = storage();
    const pendingKey = 'solb_portfolio_sync_outbox_v1:synthetic-owner';
    store.setItem(pendingKey, 'preserve old migration source');
    markProtectedPortfolioOwner('synthetic-owner', store);
    const before = [...store.rows];
    const payload = { stocks: { investing: [], watching: [], sold: [] }, snapshots: [], history: [] };
    expect(writePortfolioSyncOutbox('synthetic-owner', payload, null, store)).toBeNull();
    expect(rebasePortfolioSyncOutbox('synthetic-owner', 'new-revision', store)).toBeNull();
    expect(() => preserveUnsyncedPortfolio('synthetic-owner', JSON.parse(original).state, 'saving', store)).toThrow('encrypted_portfolio_handoff_required');
    let reset = false;
    expect(() => preparePortfolioIdentity(null, JSON.parse(original).state, store, () => { reset = true; }, () => {}))
      .toThrow('encrypted_portfolio_handoff_required');
    expect(reset).toBe(false);
    expect([...store.rows]).toEqual(before);
  });
  it('does not import private or arbitrary data from the neutral preference store', () => {
    const store = storage();
    store.setItem(PORTFOLIO_UI_PREFERENCES_KEY, JSON.stringify({ darkMode: false, stocks: ['injected'],
      portfolioOwnerId: 'other-owner', refreshInterval: -1, note: 'private' }));
    const restored = JSON.parse(readPortfolioWithUiPreferences(original, store)!);
    expect(restored.state.stocks).toEqual(JSON.parse(original).state.stocks);
    expect(restored.state.portfolioOwnerId).toBe('synthetic-owner');
    expect(restored.state.darkMode).toBe(false);
    expect(restored.state.refreshInterval).toBe(60_000);
    expect(restored.state.note).toBeUndefined();
  });
});
