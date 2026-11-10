import { USER_STORAGE_KEYS, USER_STORAGE_KEY_PREFIXES } from './userStorage';
import { PORTFOLIO_RECOVERY_PREFIX } from './portfolioIdentity';
import { reviewPortfolioVaultMigration, type PortfolioMigrationReviewInput,
  type PortfolioMigrationReview } from './portfolioVaultMigrationReview';
import { preparePortfolioVaultMigration, type MigrationLock } from './portfolioVaultMigration';

type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'length' | 'key'>;
type CloudSource = PortfolioMigrationReviewInput['cloud'];
const primaryKey = 'solb-portfolio-storage';
const outboxPrefix = 'solb_portfolio_sync_outbox_v1:';
const privateFields = ['customEvents', 'recentSymbols', 'lastImportCheckpoint', 'investorType', 'investorTypeSetAt'];
const localFields = ['portfolioOwnerId', 'stocks', 'dailySnapshots', 'portfolioImportHistory', ...privateFields,
  'currency', 'darkMode', 'autoRefresh', 'refreshInterval', 'menuFavorites', 'hiddenWidgets', 'widgetOrder'];
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function relevant(key: string): boolean {
  return (USER_STORAGE_KEYS as readonly string[]).includes(key)
    || USER_STORAGE_KEY_PREFIXES.some(prefix => key.startsWith(prefix))
    || key.startsWith(PORTFOLIO_RECOVERY_PREFIX) || key.startsWith('candle_');
}
function capture(storage: StoragePort): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  const length = storage.length;
  for (let i = 0; i < length; i++) {
    const key = storage.key(i);
    if (key === null) throw new Error('source_unavailable');
    if (!relevant(key)) continue;
    const value = storage.getItem(key);
    if (value === null || entries.some(([existing]) => existing === key)) throw new Error('source_unavailable');
    entries.push([key, value]);
  }
  if (length !== storage.length) throw new Error('source_changed');
  return entries.sort(([a], [b]) => a.localeCompare(b));
}
export type MigrationSourceReview = PortfolioMigrationReview
  | { status: 'blocked'; reason: 'storage_unavailable' | 'source_changed' | 'additional_sources' | 'cloud_unavailable' };
export interface InspectedMigrationSources {
  review: MigrationSourceReview;
  /** Rechecks the exact raw sources. It neither writes nor deletes them. */
  assertUnchanged(): void;
}
const reviewedSources = new WeakMap<InspectedMigrationSources, {
  ownerId: string; storage: StoragePort; review: Extract<PortfolioMigrationReview, { status: 'ready' }>; verify: () => void;
}>();

/** Read raw persisted bytes, never Zustand's migrated/pruned state and never the
 * legacy outbox reader which deletes invalid records. Extra side copies are an
 * explicit blocker until they have their own owned, lossless migration path.
 */
export async function inspectPortfolioMigrationSources(ownerId: string, storage: StoragePort,
  loadRawCloud: () => Promise<CloudSource>): Promise<InspectedMigrationSources> {
  const blocked = (reason: 'storage_unavailable' | 'source_changed' | 'additional_sources' | 'cloud_unavailable'): InspectedMigrationSources => ({
    review: { status: 'blocked', reason }, assertUnchanged() { throw new Error('migration_not_reviewed'); },
  });
  let entries: Array<[string, string]>;
  try { entries = capture(storage); } catch { return blocked('storage_unavailable'); }
  const assertUnchanged = () => {
    if (JSON.stringify(capture(storage)) !== JSON.stringify(entries)) throw new Error('source_changed');
  };
  const raw = new Map(entries);
  // Includes another owner's outbox and every recovery copy. Never claim them.
  if (entries.some(([key]) => key !== primaryKey && key !== outboxPrefix + ownerId)) return blocked('additional_sources');
  let local: PortfolioMigrationReviewInput['local'] = null;
  let outbox: PortfolioMigrationReviewInput['outbox'] = null;
  try {
    const text = raw.get(primaryKey);
    if (text !== undefined) {
      const parsed: unknown = JSON.parse(text);
      if (!object(parsed) || parsed.version !== 3 || Object.keys(parsed).some(key => !['state', 'version'].includes(key))
        || !object(parsed.state) || Object.keys(parsed.state).some(key => !localFields.includes(key))) throw new Error();
      const state = parsed.state;
      local = { ownerId: typeof state.portfolioOwnerId === 'string' ? state.portfolioOwnerId : null,
        payload: { stocks: state.stocks, snapshots: state.dailySnapshots, history: state.portfolioImportHistory,
          privateState: Object.fromEntries(privateFields.map(key => [key, state[key]])) } };
    }
    const pending = raw.get(outboxPrefix + ownerId);
    if (pending !== undefined) {
      const parsed: unknown = JSON.parse(pending);
      if (!object(parsed) || parsed.schema !== 'joobi-portfolio-sync-outbox-v1'
        || Object.keys(parsed).length !== 5 || typeof parsed.queuedAt !== 'string'
        || !Number.isFinite(Date.parse(parsed.queuedAt))
        || (parsed.baseUpdatedAt !== null && typeof parsed.baseUpdatedAt !== 'string')) throw new Error();
      outbox = { ownerId: typeof parsed.userId === 'string' ? parsed.userId : null,
        payload: parsed.payload, baseUpdatedAt: parsed.baseUpdatedAt as string | null };
    }
  } catch { return { review: { status: 'blocked', reason: 'unsupported_source' }, assertUnchanged }; }
  let cloud: CloudSource;
  try { cloud = await loadRawCloud(); } catch { return blocked('cloud_unavailable'); }
  try { assertUnchanged(); } catch { return blocked('source_changed'); }
  const review = reviewPortfolioVaultMigration({ ownerId, cloud, local, outbox });
  const inspected = { review, assertUnchanged };
  if (review.status === 'ready') reviewedSources.set(inspected, {
    ownerId, storage, review: JSON.parse(JSON.stringify(review)), verify: assertUnchanged,
  });
  return inspected;
}

/** Bind the inspected raw sources to the durable encrypted journal. A change
 * while waiting for the exclusive lock cannot bless a stale reviewed payload.
 */
export async function prepareInspectedPortfolioMigration(inspected: InspectedMigrationSources,
  keyInput: Pick<Parameters<typeof preparePortfolioVaultMigration>[0], 'key' | 'protectedKey' | 'descriptor'>,
  storage: StoragePort, exclusive?: MigrationLock): Promise<void> {
  const captured = reviewedSources.get(inspected);
  if (!captured || captured.ownerId !== keyInput.key.ownerId || captured.storage !== storage) throw new Error('migration_not_reviewed');
  captured.verify();
  return preparePortfolioVaultMigration({ ...keyInput, payload: captured.review.payload,
    expectedUpdatedAt: captured.review.expectedUpdatedAt, verifySourceSnapshot: captured.verify }, storage, exclusive);
}
