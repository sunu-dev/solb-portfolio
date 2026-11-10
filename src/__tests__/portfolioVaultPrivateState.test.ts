import { describe, expect, it } from 'vitest';
import { createPortfolioVaultKey, encryptPortfolioRecord } from '@/lib/portfolioVaultCrypto';
import { normalizePortfolioVaultPayload, openPortfolioPayload, portfolioVaultPayloadSignature,
  sealPortfolioPayload, type PortfolioVaultPayload } from '@/lib/portfolioVaultPayload';

const base = { stocks: { investing: [], watching: [], sold: [] }, snapshots: [], history: [] };
const complete: PortfolioVaultPayload = { ...base, privateState: {
  recentSymbols: ['PRIVATE_TEST'], investorType: 'growth', investorTypeSetAt: '2026-10-30T00:00:00+09:00',
  lastImportCheckpoint: { id: 'synthetic-checkpoint', createdAt: '2026-10-30T00:00:00+09:00', source: 'private source', stocks: base.stocks },
  customEvents: [{ id: 'synthetic-event', name: 'private plan', description: 'private description', emoji: '📝',
    startDate: '2026-10-29', baseDate: '2026-10-28', endDate: null, insight: 'private insight',
    basePrices: { PRIVATE_TEST: 123.75 }, baseMacro: {}, keyFacts: ['private fact'],
    precomputed: { PRIVATE_TEST: { maxDrop: -5, recovered: false, recoveryDays: null } } }],
} };
const ownerId = 'synthetic-payload-owner';
const context = { ownerId, purpose: 'portfolio' as const, revision: 1 };

describe('encrypted personal state preservation', () => {
  it('round-trips all previously local-only fields without exposing them in the envelope', async () => {
    const { key } = await createPortfolioVaultKey(ownerId, crypto.getRandomValues(new Uint8Array(32)));
    const record = await sealPortfolioPayload(key, context, complete);
    expect(await openPortfolioPayload(key, context, record)).toEqual(complete);
    for (const privateText of ['PRIVATE_TEST', 'private plan', 'private source', '123.75', 'growth']) {
      expect(JSON.stringify(record)).not.toContain(privateText);
    }
  });
  it('keeps the older staged payload readable without inventing empty personal state', () => {
    expect(normalizePortfolioVaultPayload(base)).toEqual(base);
    expect(normalizePortfolioVaultPayload(base)).not.toHaveProperty('privateState');
  });
  it('includes local-only changes in conflict and lost-response comparisons', () => {
    const changed = structuredClone(complete);
    changed.privateState!.customEvents[0].insight = 'changed private insight';
    expect(portfolioVaultPayloadSignature(changed)).not.toBe(portfolioVaultPayloadSignature(complete));
    expect(portfolioVaultPayloadSignature({ history: [], stocks: base.stocks, snapshots: [], privateState: complete.privateState }))
      .toBe(portfolioVaultPayloadSignature(complete));
  });
  it.each([
    { ...complete, unknownFutureField: 'must not drop' },
    { ...complete, privateState: { ...complete.privateState, unknownFutureField: 'must not drop' } },
    { ...complete, privateState: { ...complete.privateState, recentSymbols: [42] } },
    { ...complete, privateState: { ...complete.privateState, investorType: 'unknown-future-type' } },
    { ...complete, privateState: { ...complete.privateState, lastImportCheckpoint: { id: 'bad' } } },
    { ...complete, privateState: { ...complete.privateState, customEvents: [{ ...complete.privateState!.customEvents[0], basePrices: { X: NaN } }] } },
  ])('rejects unsupported or damaged personal state instead of silently discarding it', input => {
    expect(normalizePortfolioVaultPayload(input)).toBeNull();
  });
  it('rejects unsupported data even inside an authentic encrypted record', async () => {
    const { key } = await createPortfolioVaultKey(ownerId, crypto.getRandomValues(new Uint8Array(32)));
    const record = await encryptPortfolioRecord(key, context,
      new TextEncoder().encode(JSON.stringify({ ...complete, future: 'must preserve' })));
    await expect(openPortfolioPayload(key, context, record)).rejects.toMatchObject({ code: 'invalid_record' });
  });
});
