import { describe, expect, it } from 'vitest';
import { createPortfolioVaultKey, encryptPortfolioRecord, type PortfolioRecordContext } from '@/lib/portfolioVaultCrypto';
import { openPortfolioPayload, sealPortfolioPayload, normalizeLosslessPortfolioVaultPayload } from '@/lib/portfolioVaultPayload';
import type { PortfolioSyncPayload } from '@/lib/portfolioSyncOutbox';

const context: PortfolioRecordContext = { ownerId: 'vault-payload-fixture', purpose: 'portfolio', revision: 3 };
const stocks: PortfolioSyncPayload['stocks'] = {
  investing: [{ symbol: 'TEST', avgCost: 123.45, shares: 2.5, targetReturn: 10, broker: 'toss',
    notes: [{ text: 'fixture private investment note', emoji: '📝', date: '2026-10-29' }] }],
  watching: [], sold: [],
};
const payload: PortfolioSyncPayload = {
  stocks,
  snapshots: [{ date: '2026-10-29', totalValue: 400, totalCost: 308.625,
    stocks: [{ symbol: 'TEST', avgCost: 123.45, shares: 2.5, currentPrice: 160 }] }],
  history: [{ id: 'vault-fixture-checkpoint', createdAt: '2026-10-29T00:00:00.000Z',
    source: 'CSV', stocks, kind: 'import',
    summary: { added: 1, updated: 0, unchanged: 0, needsReview: 0, skippedLimit: 0 },
    changes: [], excludedCount: 0 }],
};
const create = () => createPortfolioVaultKey(context.ownerId, crypto.getRandomValues(new Uint8Array(32)));

describe('portfolio vault payload contract', () => {
  it('preserves more than twenty recovery entries without trimming older records', async () => {
    const { key } = await create();
    const source = { ...payload, history: Array.from({ length: 25 }, (_, index) => ({ ...payload.history[0], id: `history-${index}` })) };
    const record = await sealPortfolioPayload(key, context, source);
    expect((await openPortfolioPayload(key, context, record)).history).toEqual(source.history);
  });

  it.each([
    { privateFutureField: 'must not disappear' },
    { changes: [{ symbol: 'INVALID_PRIVATE_CHANGE' }] },
    { summary: { ...payload.history[0].summary, added: -1 } },
  ])('refuses lossy history normalization', async fields => {
    const { key } = await create();
    const source = { ...payload, history: [{ ...payload.history[0], ...fields }] } as PortfolioSyncPayload;
    await expect(sealPortfolioPayload(key, context, source)).rejects.toMatchObject({ code: 'invalid_record' });
    const record = await encryptPortfolioRecord(key, context, new TextEncoder().encode(JSON.stringify(source)));
    await expect(openPortfolioPayload(key, context, record)).rejects.toMatchObject({ code: 'invalid_record' });
  });

  it('requires explicit reconciliation of discarded demo or unknown categories before migration', () => {
    expect(normalizeLosslessPortfolioVaultPayload(payload)).toEqual(payload);
    expect(normalizeLosslessPortfolioVaultPayload({ ...payload, stocks: { ...stocks, futureCategory: [] } })).toBeNull();
    expect(normalizeLosslessPortfolioVaultPayload({ ...payload, stocks: { ...stocks, watching: [{ ...stocks.investing[0], demo: true }] } })).toBeNull();
  });
  it('preserves private holdings, notes, snapshots and restore checkpoints inside the ciphertext', async () => {
    const { key } = await create();
    const record = await sealPortfolioPayload(key, context, payload);
    const reopened = await openPortfolioPayload(key, context, record);
    expect(reopened.stocks).toEqual(stocks);
    expect(reopened.snapshots).toEqual(payload.snapshots);
    expect(reopened.history).toEqual(payload.history);
    const serialized = JSON.stringify(record);
    for (const privateText of ['TEST', '123.45', 'fixture private investment note', 'CSV']) {
      expect(serialized).not.toContain(privateText);
    }
  });

  it('continues to exclude demo stocks from records', async () => {
    const { key } = await create();
    const source = { ...payload, stocks: { ...stocks, watching: [{ ...stocks.investing[0], demo: true }] } };
    const record = await sealPortfolioPayload(key, context, source);
    expect((await openPortfolioPayload(key, context, record)).stocks.watching).toEqual([]);
    expect(source.stocks.watching).toHaveLength(1);
  });

  it('accepts genuinely empty payloads but never turns decrypt errors into empty accounts', async () => {
    const { key } = await create();
    const empty: PortfolioSyncPayload = { stocks: { investing: [], watching: [], sold: [] }, snapshots: [], history: [] };
    const record = await sealPortfolioPayload(key, context, empty);
    expect(await openPortfolioPayload(key, context, record)).toEqual(empty);
    await expect(openPortfolioPayload(key, { ...context, revision: 4 }, record))
      .rejects.toMatchObject({ code: 'cannot_decrypt' });
  });

  it.each(['invalid-json', 'invalid-utf8', 'legacy-schema'] as const)('rejects decrypted %s', async input => {
    const { key } = await create();
    const bytes = input === 'invalid-utf8' ? new Uint8Array([0xff])
      : new TextEncoder().encode(input === 'legacy-schema' ? '{"stocks":{}}' : '{');
    const record = await encryptPortfolioRecord(key, context, bytes);
    await expect(openPortfolioPayload(key, context, record)).rejects.toMatchObject({ code: 'invalid_record' });
  });

  it('does not leak malformed input through its errors', async () => {
    const { key } = await create();
    const invalid = { stocks: { investing: [{ notes: 'private content' }] } } as unknown as PortfolioSyncPayload;
    await expect(sealPortfolioPayload(key, context, invalid))
      .rejects.toMatchObject({ code: 'invalid_record', message: 'invalid_record' });
  });
});
