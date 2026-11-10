import { describe, expect, it } from 'vitest';
import { hasLegacyPortfolioSources, hasPrivatePortfolioInMemory } from '@/lib/portfolioVaultEntry';

describe('fresh-device private reader preflight', () => {
  it.each(['solb-portfolio-storage', 'solb_portfolio_sync_outbox_v1:owner',
    'solb_portfolio_recovery_v1:owner:backup', 'joobi_portfolio_migration_v1:owner',
    'solb_market_guide_v1', 'candle_AAPL'])('preserves and blocks existing source %s', key => {
    expect(hasLegacyPortfolioSources({ length: 1, key: () => key })).toBe(true);
  });
  it('allows neutral preferences and account protection markers', () => {
    const keys = ['joobi_portfolio_ui_v1', 'joobi_portfolio_protection_v1:owner', 'sb-synthetic-auth-token'];
    expect(hasLegacyPortfolioSources({ length: keys.length, key: index => keys[index] })).toBe(false);
  });
  it('fails closed when storage iteration loses an entry', () => {
    expect(() => hasLegacyPortfolioSources({ length: 1, key: () => null })).toThrow();
  });
  it('does not overwrite in-memory private records even without a storage copy', () => {
    const empty = { stocks: { investing: [], watching: [], sold: [] }, dailySnapshots: [],
      portfolioImportHistory: [], customEvents: [], recentSymbols: [], lastImportCheckpoint: null,
      investorType: 'diversified', investorTypeSetAt: null };
    expect(hasPrivatePortfolioInMemory(empty)).toBe(false);
    for (const patch of [{ recentSymbols: ['PRIVATE'] }, { investorType: 'growth' },
      { stocks: { investing: [{}], watching: [], sold: [] } }, { lastImportCheckpoint: {} },
      { dailySnapshots: [{}] }, { portfolioImportHistory: [{}] }, { customEvents: [{}] }]) {
      expect(hasPrivatePortfolioInMemory({ ...empty, ...patch })).toBe(true);
    }
  });
});
