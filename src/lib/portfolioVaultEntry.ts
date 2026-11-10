import { USER_STORAGE_KEYS, USER_STORAGE_KEY_PREFIXES } from './userStorage';
import { PORTFOLIO_RECOVERY_PREFIX } from './portfolioIdentity';
import { PORTFOLIO_MIGRATION_PREFIX } from './portfolioVaultMigration';
import { DEFAULT_INVESTOR_TYPE } from '@/config/investorTypes';

/** Conservative fresh-device reader precondition. Existing sources are never
 * deleted or claimed here: the migration workflow must handle them separately.
 */
export function hasLegacyPortfolioSources(storage: Pick<Storage, 'length' | 'key'>): boolean {
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key === null) throw new Error('portfolio_storage_changed');
    if ((USER_STORAGE_KEYS as readonly string[]).includes(key)
      || USER_STORAGE_KEY_PREFIXES.some(prefix => key.startsWith(prefix))
      || key.startsWith(PORTFOLIO_RECOVERY_PREFIX) || key.startsWith(PORTFOLIO_MIGRATION_PREFIX)
      || key.startsWith('candle_')) return true;
  }
  return false;
}

export function hasPrivatePortfolioInMemory(state: {
  stocks: Record<string, unknown[]>; dailySnapshots: unknown[]; portfolioImportHistory: unknown[];
  customEvents: unknown[]; recentSymbols: string[]; lastImportCheckpoint: unknown;
  investorType: string; investorTypeSetAt: unknown;
}): boolean {
  return Object.values(state.stocks).some(items => items.length > 0)
    || state.dailySnapshots.length > 0 || state.portfolioImportHistory.length > 0
    || state.customEvents.length > 0 || state.recentSymbols.length > 0
    || state.lastImportCheckpoint != null || state.investorTypeSetAt != null
    || state.investorType !== DEFAULT_INVESTOR_TYPE;
}
