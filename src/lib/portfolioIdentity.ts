import { USER_STORAGE_KEYS, USER_STORAGE_KEY_PREFIXES } from './userStorage';

// Recovery copies are deliberately outside clearUserStorage's key lists.
export const PORTFOLIO_RECOVERY_PREFIX = 'solb_portfolio_recovery_v1:';

export interface LocalPortfolio {
  portfolioOwnerId?: string | null;
  stocks?: Record<string, unknown[]>;
  dailySnapshots?: unknown[];
  portfolioImportHistory?: unknown[];
  lastImportCheckpoint?: unknown;
  customEvents?: unknown[];
  recentSymbols?: unknown[];
}

/** A legacy, unowned portfolio must never be claimed by the next login. */
export function preparePortfolioIdentity(
  userId: string | null,
  state: LocalPortfolio,
  storage: Storage,
  reset: () => void,
  assignOwner: (id: string | null) => void,
): void {
  if (userId && state.portfolioOwnerId === userId) return;

  const records: Record<string, string> = {};
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && ((USER_STORAGE_KEYS as readonly string[]).includes(key)
      || USER_STORAGE_KEY_PREFIXES.some(prefix => key.startsWith(prefix)))) {
      const value = storage.getItem(key);
      if (value !== null) records[key] = value;
    }
  }
  const hasRecords = Boolean(state.portfolioOwnerId || state.lastImportCheckpoint
    || Object.values(state.stocks ?? {}).some(items => items.length)
    || state.dailySnapshots?.length || state.portfolioImportHistory?.length
    || state.customEvents?.length || state.recentSymbols?.length
    || Object.keys(records).some(key => key.startsWith('solb_portfolio_sync_outbox_v1:')));
  if (hasRecords) {
    const backup = JSON.stringify({ ownerId: state.portfolioOwnerId ?? null, state, records });
    const key = `${PORTFOLIO_RECOVERY_PREFIX}${crypto.randomUUID()}`;
    // Fail closed BEFORE any reset when storage is full/blocked. Never discard unsynced data.
    storage.setItem(key, backup);
    if (storage.getItem(key) !== backup) throw new Error('Portfolio recovery could not be verified');
  }
  reset();
  assignOwner(userId);
}
