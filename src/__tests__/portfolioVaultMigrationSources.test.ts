import { describe, expect, it, vi } from 'vitest';
import { inspectPortfolioMigrationSources, prepareInspectedPortfolioMigration } from '@/lib/portfolioVaultMigrationSources';
import { createPortfolioVaultKey } from '@/lib/portfolioVaultCrypto';
import { PORTFOLIO_UNLOCK_FORMAT } from '@/lib/portfolioVaultPasskey';
import { PORTFOLIO_MIGRATION_PREFIX } from '@/lib/portfolioVaultMigration';

function fixture() {
  const ownerId = crypto.randomUUID();
  const base = { stocks: { investing: [], watching: [], sold: [] }, snapshots: [], history: [] };
  const state = { portfolioOwnerId: ownerId, stocks: base.stocks, dailySnapshots: [], portfolioImportHistory: [],
    customEvents: [], recentSymbols: ['PRIVATE'], lastImportCheckpoint: null, investorType: 'growth', investorTypeSetAt: null };
  const values = new Map([['solb-portfolio-storage', JSON.stringify({ state, version: 3 })]]);
  const storage = { get length() { return values.size; }, key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const cloud = vi.fn(async () => ({ ownerId, payload: base, updatedAt: '2026-10-30T00:00:00Z' }));
  return { ownerId, state, values, storage, cloud,
    inspect: () => inspectPortfolioMigrationSources(ownerId, storage, cloud) };
}
const descriptor = { format: PORTFOLIO_UNLOCK_FORMAT, credentialId: 'YWJj', input: Buffer.alloc(32, 3).toString('base64url') } as const;
const exclusive = async <T,>(_owner: string, work: () => Promise<T>): Promise<T> => work();

describe('raw migration source capture', () => {
  it('connects raw review to a durable encrypted intent without changing the original', async () => {
    const f = fixture(); const before = f.values.get('solb-portfolio-storage');
    const inspected = await f.inspect();
    expect(inspected.review.status).toBe('ready');
    const made = await createPortfolioVaultKey(f.ownerId, crypto.getRandomValues(new Uint8Array(32)));
    await prepareInspectedPortfolioMigration(inspected, { ...made, descriptor }, f.storage, exclusive);
    expect(f.values.get('solb-portfolio-storage')).toBe(before);
    expect(f.values.get(PORTFOLIO_MIGRATION_PREFIX + f.ownerId)).not.toContain('PRIVATE');
  });
  it.each(['solb_portfolio_recovery_v1:old', 'solb_market_guide_v1', 'solb_portfolio_sync_outbox_v1:other'])('blocks unhandled side copy %s before any cloud read', async key => {
    const f = fixture(); f.values.set(key, 'private-copy');
    expect((await f.inspect()).review).toEqual({ status: 'blocked', reason: 'additional_sources' });
    expect(f.cloud).not.toHaveBeenCalled(); expect(f.values.get(key)).toBe('private-copy');
  });
  it('keeps malformed outboxes instead of using the destructive legacy reader', async () => {
    const f = fixture(); const key = 'solb_portfolio_sync_outbox_v1:' + f.ownerId;
    f.values.set(key, '{broken private data');
    expect((await f.inspect()).review.status).toBe('blocked');
    expect(f.values.get(key)).toBe('{broken private data');
  });
  it('blocks older storage versions and unknown fields instead of silently migrating away data', async () => {
    const f = fixture(); f.values.set('solb-portfolio-storage', JSON.stringify({ state: { ...f.state, apiKey: 'OLD_SECRET' }, version: 2 }));
    expect((await f.inspect()).review).toEqual({ status: 'blocked', reason: 'unsupported_source' });
    expect(f.cloud).not.toHaveBeenCalled();
  });
  it('detects edits while awaiting cloud data', async () => {
    const f = fixture(); const original = f.cloud.getMockImplementation()!;
    f.cloud.mockImplementation(async () => { f.values.set('solb-portfolio-storage', 'changed'); return original(); });
    expect((await f.inspect()).review).toEqual({ status: 'blocked', reason: 'source_changed' });
  });
  it('checks the reviewed snapshot again after waiting for the migration lock', async () => {
    const f = fixture(); const inspected = await f.inspect();
    const made = await createPortfolioVaultKey(f.ownerId, crypto.getRandomValues(new Uint8Array(32)));
    await expect(prepareInspectedPortfolioMigration(inspected, { ...made, descriptor }, f.storage, async (_owner, work) => {
      f.values.set('solb-portfolio-storage', 'new edit'); return work();
    })).rejects.toMatchObject({ code: 'conflict' });
    expect(f.values.has(PORTFOLIO_MIGRATION_PREFIX + f.ownerId)).toBe(false);
  });
  it('rejects another owner and forged review handles', async () => {
    const f = fixture(); const inspected = await f.inspect();
    const made = await createPortfolioVaultKey(crypto.randomUUID(), crypto.getRandomValues(new Uint8Array(32)));
    await expect(prepareInspectedPortfolioMigration(inspected, { ...made, descriptor }, f.storage, exclusive)).rejects.toThrow('migration_not_reviewed');
    await expect(prepareInspectedPortfolioMigration({ ...inspected }, { ...made, descriptor }, f.storage, exclusive)).rejects.toThrow('migration_not_reviewed');
    expect(f.values.size).toBe(1);
  });
  it('does not interpret cloud errors as empty portfolios', async () => {
    const f = fixture(); f.cloud.mockRejectedValue(new Error('private provider detail'));
    expect((await f.inspect()).review).toEqual({ status: 'blocked', reason: 'cloud_unavailable' });
  });
  it('binds review to the same storage and ignores mutation of its public result', async () => {
    const f = fixture(); const inspected = await f.inspect();
    const made = await createPortfolioVaultKey(f.ownerId, crypto.getRandomValues(new Uint8Array(32)));
    await expect(prepareInspectedPortfolioMigration(inspected, { ...made, descriptor }, { ...f.storage }, exclusive)).rejects.toThrow('migration_not_reviewed');
    if (inspected.review.status !== 'ready') throw new Error();
    inspected.review.payload.privateState!.recentSymbols = ['MUTATED'];
    inspected.assertUnchanged = () => {};
    f.values.set('solb-portfolio-storage', 'new edit');
    await expect(prepareInspectedPortfolioMigration(inspected, { ...made, descriptor }, f.storage, exclusive)).rejects.toThrow('source_changed');
    expect(f.values.has(PORTFOLIO_MIGRATION_PREFIX + f.ownerId)).toBe(false);
  });
});
