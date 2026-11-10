/** Build-time preview gate, not an enrollment authorization mechanism. Once the
 * reader is released it must stay enabled; enrollment remains server controlled.
 */
export const PORTFOLIO_VAULT_READER_ENABLED = process.env.NEXT_PUBLIC_PORTFOLIO_VAULT_READER === 'on';
const MARKER_PREFIX = 'joobi_portfolio_protection_v1:';
// Browser-wide latch survives owner reset/logout. An older reader must never
// turn an unlocked account's in-memory data back into a plaintext recovery copy.
const PRIVATE_STORAGE_MARKER = 'joobi_portfolio_private_storage_v1';
export const PORTFOLIO_UI_PREFERENCES_KEY = 'joobi_portfolio_ui_v1';
type StorageReader = Pick<Storage, 'getItem' | 'setItem'>;

function browserStorage(): StorageReader | null {
  if (typeof window === 'undefined') return null;
  // A blocked storage getter is an error, never proof that an account is legacy.
  return window.localStorage;
}
function ownerId(value: string): void {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new Error('invalid_portfolio_owner');
}
export function isProtectedPortfolioOwner(userId: string, storage: StorageReader | null = browserStorage()): boolean {
  ownerId(userId);
  if (!storage) return false;
  const marker = storage.getItem(MARKER_PREFIX + userId);
  // Unknown nonempty markers also fail closed (future versions/corruption).
  return marker !== null;
}
export function markProtectedPortfolioOwner(userId: string, storage: StorageReader | null = browserStorage()): void {
  ownerId(userId);
  if (!storage) throw new Error('portfolio_storage_unavailable');
  holdPrivateStorage(storage);
  const key = MARKER_PREFIX + userId;
  storage.setItem(key, 'vault-v1');
  if (storage.getItem(key) !== 'vault-v1') throw new Error('portfolio_storage_unavailable');
}
function holdPrivateStorage(storage: StorageReader): void {
  storage.setItem(PRIVATE_STORAGE_MARKER, 'vault-v1');
  if (storage.getItem(PRIVATE_STORAGE_MARKER) !== 'vault-v1') throw new Error('portfolio_storage_unavailable');
}
export function allowLegacyPortfolioWrite(
  userId: string | null, storage?: StorageReader | null,
  secureReaderEnabled = PORTFOLIO_VAULT_READER_ENABLED,
): boolean {
  if (secureReaderEnabled) return false;
  try {
    const target = storage === undefined ? browserStorage() : storage;
    if (target && target.getItem(PRIVATE_STORAGE_MARKER) !== null) return false;
    return !userId || !isProtectedPortfolioOwner(userId, target);
  }
  catch { return false; }
}

/** Neutral presentation preferences only. The original legacy portfolio is left
 * untouched until an explicit, verified migration handles pending/recovery data.
 */
export function routeProtectedPortfolioPersistence(
  serialized: string, storage: StorageReader,
  secureReaderEnabled = PORTFOLIO_VAULT_READER_ENABLED,
): boolean {
  let state: Record<string, unknown>;
  try {
    const parsed = JSON.parse(serialized);
    if (!parsed?.state || typeof parsed.state !== 'object' || Array.isArray(parsed.state)) throw new Error();
    state = parsed.state;
  } catch { throw new Error('invalid_portfolio_storage'); }
  const userId = typeof state.portfolioOwnerId === 'string' ? state.portfolioOwnerId : null;
  if (allowLegacyPortfolioWrite(userId, storage, secureReaderEnabled)) return false;
  holdPrivateStorage(storage);
  const preferences: Record<string, unknown> = {};
  for (const field of ['darkMode', 'autoRefresh'] as const) {
    if (typeof state[field] === 'boolean') preferences[field] = state[field];
  }
  if (state.currency === 'KRW' || state.currency === 'USD') preferences.currency = state.currency;
  if (typeof state.refreshInterval === 'number' && Number.isFinite(state.refreshInterval)
    && state.refreshInterval >= 5_000 && state.refreshInterval <= 3_600_000) preferences.refreshInterval = state.refreshInterval;
  storage.setItem(PORTFOLIO_UI_PREFERENCES_KEY, JSON.stringify(preferences));
  return true;
}

export function readPortfolioWithUiPreferences(raw: string | null, storage: StorageReader): string | null {
  const text = storage.getItem(PORTFOLIO_UI_PREFERENCES_KEY);
  if (!text) return raw;
  try {
    const preferences = JSON.parse(text);
    const parsed = raw ? JSON.parse(raw) : { state: {}, version: 3 };
    const state = { ...parsed.state };
    for (const field of ['darkMode', 'autoRefresh']) if (typeof preferences?.[field] === 'boolean') state[field] = preferences[field];
    if (preferences?.currency === 'KRW' || preferences?.currency === 'USD') state.currency = preferences.currency;
    if (typeof preferences?.refreshInterval === 'number' && Number.isFinite(preferences.refreshInterval)
      && preferences.refreshInterval >= 5_000 && preferences.refreshInterval <= 3_600_000) state.refreshInterval = preferences.refreshInterval;
    return JSON.stringify({ ...parsed, state });
  } catch { return raw; }
}
