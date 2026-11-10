import { describe, expect, it } from 'vitest';
import { reviewPortfolioVaultMigration, type PortfolioMigrationReviewInput } from '@/lib/portfolioVaultMigrationReview';

function fixture(): PortfolioMigrationReviewInput {
  const ownerId = crypto.randomUUID();
  const base = { stocks: { investing: [{ symbol: 'PRIVATE', avgCost: 12, shares: 3, targetReturn: 0 }], watching: [], sold: [] }, snapshots: [], history: [] };
  return { ownerId, cloud: { ownerId, payload: base, updatedAt: '2026-10-30T01:00:00.123456+00:00' },
    local: { ownerId, payload: { ...base, privateState: { customEvents: [], recentSymbols: ['PRIVATE'],
      lastImportCheckpoint: null, investorType: 'growth', investorTypeSetAt: null } } }, outbox: null };
}
describe('owned migration source review', () => {
  it('blocks nonempty legacy settings rather than dropping them from the vault', () => {
    const input = fixture(); input.cloud!.settings = { privateNote: 'must remain' };
    expect(reviewPortfolioVaultMigration(input)).toEqual({ status: 'blocked', reason: 'unsupported_source', source: 'cloud' });
    input.cloud!.settings = {};
    expect(reviewPortfolioVaultMigration(input).status).toBe('ready');
  });
  it('retains device-only personal state and exact server CAS timestamp', () => {
    const input = fixture();
    const result = reviewPortfolioVaultMigration(input);
    expect(result).toEqual({ status: 'ready', payload: input.local!.payload,
      expectedUpdatedAt: input.cloud!.updatedAt, sources: ['cloud', 'local'] });
    if (result.status !== 'ready') throw new Error();
    result.payload.privateState!.recentSymbols.push('NEW');
    expect((input.local!.payload as typeof result.payload).privateState!.recentSymbols).toEqual(['PRIVATE']);
  });
  it.each([null, 'another-owner'])('never assigns source owner %s to the signed-in account', ownerId => {
    const input = fixture(); input.local!.ownerId = ownerId;
    const result = reviewPortfolioVaultMigration(input);
    expect(result).toEqual({ status: 'blocked', reason: ownerId ? 'different_owner' : 'unowned_source', source: 'local' });
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
  });
  it('requires explicit resolution even when a divergent pending copy is newer', () => {
    const input = fixture();
    input.outbox = { ownerId: input.ownerId, baseUpdatedAt: input.cloud!.updatedAt,
      payload: { stocks: { investing: [], watching: [], sold: [] }, snapshots: [], history: [] } };
    expect(reviewPortfolioVaultMigration(input)).toEqual({ status: 'conflict', sources: ['cloud', 'local', 'outbox'] });
  });
  it('does not invent missing device-only fields or treat absence as an empty account', () => {
    const input = fixture(); input.local = null;
    expect(reviewPortfolioVaultMigration(input)).toEqual({ status: 'blocked', reason: 'missing_private_state' });
    input.cloud = null;
    expect(reviewPortfolioVaultMigration(input)).toEqual({ status: 'blocked', reason: 'no_sources' });
  });
  it('does not silently discard unknown data during source collection', () => {
    const input = fixture(); input.cloud!.payload = { ...(input.cloud!.payload as object), futurePrivateData: 'private' };
    expect(reviewPortfolioVaultMigration(input)).toEqual({ status: 'blocked', reason: 'unsupported_source', source: 'cloud' });
  });
  it('detects private-state-only differences between full copies', () => {
    const input = fixture();
    const copy = JSON.parse(JSON.stringify(input.local!.payload)); copy.privateState.recentSymbols = ['OTHER'];
    input.outbox = { ownerId: input.ownerId, payload: copy, baseUpdatedAt: input.cloud!.updatedAt };
    expect(reviewPortfolioVaultMigration(input).status).toBe('conflict');
  });
  it('allows an owned local-only account but blocks an outbox whose old server row disappeared', () => {
    const input = fixture(); input.cloud = null;
    expect(reviewPortfolioVaultMigration(input)).toMatchObject({ status: 'ready', expectedUpdatedAt: null });
    input.outbox = { ...input.local!, baseUpdatedAt: '2026-10-29T00:00:00Z' };
    expect(reviewPortfolioVaultMigration(input).status).toBe('conflict');
  });
});
