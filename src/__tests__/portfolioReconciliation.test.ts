import { describe, expect, it } from 'vitest';
import type { PortfolioStocks } from '@/config/constants';
import {
  applyPortfolioReconciliation,
  buildPortfolioImportChanges,
  normalizePortfolioVersions,
  prependPortfolioVersion,
  reconcilePortfolioImport,
} from '@/lib/portfolioReconciliation';

const EMPTY: PortfolioStocks = { investing: [], watching: [], sold: [] };

describe('portfolio reconciliation', () => {
  it('treats the same ticker at another broker as a new holding', () => {
    const stocks: PortfolioStocks = {
      ...EMPTY,
      investing: [{ symbol: 'NVDA', avgCost: 100, shares: 2, targetReturn: 10, broker: 'toss' }],
    };
    const [row] = reconcilePortfolioImport([
      { symbol: 'nvda', name: 'NVIDIA', avgCost: 120, shares: 1, currency: 'USD' },
    ], stocks, 'kiwoom');

    expect(row.status).toBe('new');
  });

  it('shows field changes for an existing broker holding', () => {
    const stocks: PortfolioStocks = {
      ...EMPTY,
      investing: [{ symbol: '005930', avgCost: 70000, shares: 10, targetReturn: 10, broker: 'samsung' }],
    };
    const [row] = reconcilePortfolioImport([
      { symbol: '005930', name: '삼성전자', avgCost: 71000, shares: 12, currency: 'KRW' },
    ], stocks, 'samsung');

    expect(row.status).toBe('changed');
    expect(row.changes).toEqual([
      { field: 'avgCost', before: 70000, after: 71000 },
      { field: 'shares', before: 10, after: 12 },
    ]);
  });

  it('matches bare and suffixed Korean codes instead of creating a duplicate holding', () => {
    const stocks: PortfolioStocks = {
      ...EMPTY,
      investing: [{
        symbol: '005930.KS',
        currency: 'KRW',
        avgCost: 70_000,
        shares: 10,
        targetReturn: 10,
        broker: 'samsung',
      }],
    };
    const [row] = reconcilePortfolioImport([
      { symbol: '005930', name: '삼성전자', avgCost: 71_000, shares: 12, currency: 'USD' },
    ], stocks, 'samsung');

    expect(row.status).toBe('changed');
    expect(row.match?.stock.symbol).toBe('005930.KS');
    expect(row.draft.currency).toBe('KRW');
  });

  it('flags bare and suffixed aliases repeated in one upload as duplicates', () => {
    const rows = reconcilePortfolioImport([
      { symbol: '005930', avgCost: 70_000, shares: 1, currency: 'KRW' },
      { symbol: '005930.KS', avgCost: 70_000, shares: 1, currency: 'KRW' },
    ], EMPTY, 'samsung');

    expect(rows.every((row) => row.reason === 'duplicate_in_upload')).toBe(true);
  });

  it('does not guess when an unknown broker matches multiple accounts', () => {
    const stocks: PortfolioStocks = {
      ...EMPTY,
      investing: [
        { symbol: 'AAPL', avgCost: 100, shares: 2, targetReturn: 10, broker: 'toss' },
        { symbol: 'AAPL', avgCost: 150, shares: 3, targetReturn: 10, broker: 'mirae' },
      ],
    };
    const [row] = reconcilePortfolioImport([
      { symbol: 'AAPL', name: 'Apple', avgCost: 160, shares: 4, currency: 'USD' },
    ], stocks, '');

    expect(row.status).toBe('needs_review');
    expect(row.reason).toBe('broker_required');
  });

  it('requires a broker before changing an investing record', () => {
    const [row] = reconcilePortfolioImport([
      { symbol: 'AAPL', avgCost: 160, shares: 4, currency: 'USD' },
    ], EMPTY, '');

    expect(row.status).toBe('needs_review');
    expect(row.reason).toBe('broker_required');
  });

  it('does not overwrite an existing holding whose broker was never assigned', () => {
    const stocks: PortfolioStocks = {
      ...EMPTY,
      investing: [{ symbol: 'MSFT', avgCost: 300, shares: 2, targetReturn: 10 }],
    };
    const [row] = reconcilePortfolioImport([
      { symbol: 'MSFT', avgCost: 320, shares: 2, currency: 'USD' },
    ], stocks, 'toss');

    expect(row.status).toBe('needs_review');
    expect(row.reason).toBe('unassigned_existing_match');
  });

  it('flags repeated rows in one upload instead of applying both', () => {
    const rows = reconcilePortfolioImport([
      { symbol: 'TSLA', avgCost: 200, shares: 1, currency: 'USD' },
      { symbol: 'tsla', avgCost: 200, shares: 1, currency: 'USD' },
    ], EMPTY, 'toss');

    expect(rows.every((row) => row.reason === 'duplicate_in_upload')).toBe(true);
  });

  it('applies additions and updates atomically without mutating the source', () => {
    const stocks: PortfolioStocks = {
      ...EMPTY,
      investing: [{ symbol: 'AAPL', avgCost: 100, shares: 2, targetReturn: 15, broker: 'toss' }],
    };
    const rows = reconcilePortfolioImport([
      { symbol: 'AAPL', avgCost: 110, shares: 3, currency: 'USD' },
      { symbol: 'MSFT', avgCost: 400, shares: 1, currency: 'USD' },
    ], stocks, 'toss');
    const result = applyPortfolioReconciliation(stocks, rows, new Set([0, 1]), 'toss');

    expect(result.summary).toMatchObject({ added: 1, updated: 1 });
    expect(result.stocks.investing).toHaveLength(2);
    expect(result.stocks.investing[0]).toMatchObject({ avgCost: 110, shares: 3, targetReturn: 15 });
    expect(stocks.investing[0]).toMatchObject({ avgCost: 100, shares: 2 });
  });

  it('stores only approved changes as a privacy-safe version summary', () => {
    const stocks: PortfolioStocks = {
      ...EMPTY,
      investing: [{ symbol: 'AAPL', avgCost: 100, shares: 2, targetReturn: 15, broker: 'toss' }],
    };
    const rows = reconcilePortfolioImport([
      { symbol: 'AAPL', name: 'Apple', avgCost: 110, shares: 3, currency: 'USD' },
      { symbol: 'MSFT', name: 'Microsoft', avgCost: 400, shares: 1, currency: 'USD' },
    ], stocks, 'toss');

    const changes = buildPortfolioImportChanges(
      rows,
      new Set([0]),
      () => ({ broker: 'toss', targetCategory: 'investing' }),
    );

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      kind: 'updated',
      symbol: 'AAPL',
      broker: 'toss',
      fields: [
        { field: 'avgCost', before: 100, after: 110 },
        { field: 'shares', before: 2, after: 3 },
      ],
    });
  });

  it('drops malformed recovery points and keeps the newest 20 versions', () => {
    const validEntries = Array.from({ length: 21 }, (_, index) => ({
      id: `version-${index}`,
      createdAt: `2026-07-${String(28 - Math.min(index, 27)).padStart(2, '0')}T00:00:00.000Z`,
      source: 'CSV 가져오기',
      stocks: EMPTY,
      kind: 'import' as const,
      summary: {
        added: 1,
        updated: 0,
        unchanged: 0,
        needsReview: 0,
        skippedLimit: 0,
      },
      changes: [],
      excludedCount: 0,
    }));
    const history = normalizePortfolioVersions([
      ...validEntries,
      { id: 'broken', stocks: null },
    ]);

    expect(history).toHaveLength(20);
    expect(history[0].id).toBe('version-0');
    expect(history.at(-1)?.id).toBe('version-19');

    const prepended = prependPortfolioVersion(history, {
      ...validEntries[0],
      id: 'latest',
    });
    expect(prepended).toHaveLength(20);
    expect(prepended[0].id).toBe('latest');
  });
});
