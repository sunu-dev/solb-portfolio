/** Staged migration coordinator. Stores a recoverable encrypted intent BEFORE
 * replacing a legacy server row. It never deletes local legacy sources. Source
 * reconciliation, notification quiescence and rollout authorization are separate
 * mandatory gates; this module is not imported by production UI.
 */
import { parseEncryptedPortfolioRecord, parseProtectedPortfolioKey, encryptPortfolioRecord, decryptPortfolioRecord,
  type PortfolioVaultKey, type ProtectedPortfolioKey } from './portfolioVaultCrypto';
import { parsePortfolioPasskeyDescriptor, type PortfolioPasskeyDescriptor } from './portfolioVaultPasskey';
import { normalizeLosslessPortfolioVaultPayload, openPortfolioPayload,
  portfolioVaultPayloadSignature, type PortfolioVaultPayload } from './portfolioVaultPayload';
import { initializePortfolioVault, readPortfolioVault, type PortfolioVaultRpc } from './portfolioVaultSync';
import { USER_STORAGE_KEYS, USER_STORAGE_KEY_PREFIXES } from './userStorage';
import { PORTFOLIO_RECOVERY_PREFIX } from './portfolioIdentity';

export const PORTFOLIO_MIGRATION_PREFIX = 'joobi_portfolio_migration_v1:';
interface Journal {
  format: 'joobi-vault-migration-v1'; ownerId: string;
  protectedKey: ProtectedPortfolioKey; descriptor: PortfolioPasskeyDescriptor;
  record: Awaited<ReturnType<typeof encryptPortfolioRecord>>;
}
type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'length' | 'key'>;
type Unlock = (ownerId: string, key: ProtectedPortfolioKey, descriptor: PortfolioPasskeyDescriptor) => Promise<PortfolioVaultKey>;
export type MigrationLock = <T>(ownerId: string, work: () => Promise<T>) => Promise<T>;
export class PortfolioVaultMigrationError extends Error {
  constructor(readonly code: 'invalid_intent' | 'pending_migration' | 'storage_unavailable'
    | 'lock_unavailable' | 'conflict' | 'disabled' | 'unverified' | 'unavailable') {
    super(code); this.name = 'PortfolioVaultMigrationError';
  }
}
const browserLock: MigrationLock = async (ownerId, work) => {
  if (typeof navigator === 'undefined' || !navigator.locks) throw new PortfolioVaultMigrationError('lock_unavailable');
  return navigator.locks.request(`joobi-vault-migration:${ownerId}`, { mode: 'exclusive' }, work);
};
function owner(id: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new PortfolioVaultMigrationError('invalid_intent');
}
function parse(text: string, ownerId: string): Journal {
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 5
      || value.format !== 'joobi-vault-migration-v1' || value.ownerId !== ownerId) throw new Error();
    const record = parseEncryptedPortfolioRecord(value.record);
    const protectedKey = parseProtectedPortfolioKey(value.protectedKey);
    if (record.keyId !== protectedKey.keyId) throw new Error();
    return { format: value.format, ownerId,
      record, protectedKey, descriptor: parsePortfolioPasskeyDescriptor(value.descriptor) };
  } catch { throw new PortfolioVaultMigrationError('invalid_intent'); }
}
function read(storage: StoragePort, ownerId: string): string | null {
  try { return storage.getItem(PORTFOLIO_MIGRATION_PREFIX + ownerId); }
  catch { throw new PortfolioVaultMigrationError('storage_unavailable'); }
}
function persist(storage: StoragePort, journal: Journal): void {
  const text = JSON.stringify(journal);
  try {
    storage.setItem(PORTFOLIO_MIGRATION_PREFIX + journal.ownerId, text);
    if (read(storage, journal.ownerId) !== text) throw new Error();
  } catch { throw new PortfolioVaultMigrationError('storage_unavailable'); }
}

interface SourceFingerprint { key: string; digest: string }
function sourceKey(key: string): boolean {
  return (USER_STORAGE_KEYS as readonly string[]).includes(key)
    || USER_STORAGE_KEY_PREFIXES.some(prefix => key.startsWith(prefix))
    || key.startsWith(PORTFOLIO_RECOVERY_PREFIX) || key.startsWith('candle_');
}
function sourceSnapshot(storage: StoragePort): Array<[string, string]> {
  try {
    const sources: Array<[string, string]> = [];
    const count = storage.length;
    if (!Number.isSafeInteger(count) || count < 0) throw new Error();
    for (let i = 0; i < count; i++) {
      const key = storage.key(i);
      if (key === null) throw new Error();
      if (!sourceKey(key)) continue;
      const text = storage.getItem(key);
      if (text === null || sources.some(([existing]) => existing === key)) throw new Error();
      sources.push([key, text]);
    }
    if (storage.length !== count) throw new Error();
    return sources.sort(([a], [b]) => a.localeCompare(b));
  } catch { throw new PortfolioVaultMigrationError('storage_unavailable'); }
}
async function fingerprintSources(storage: StoragePort): Promise<SourceFingerprint[]> {
  const snapshot = sourceSnapshot(storage);
  const result = await Promise.all(snapshot.map(async ([key, text]) => {
    const bytes = new TextEncoder().encode(text);
    try {
      const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
      return { key, digest: Array.from(hash, byte => byte.toString(16).padStart(2, '0')).join('') };
    } finally { bytes.fill(0); }
  }));
  if (JSON.stringify(snapshot) !== JSON.stringify(sourceSnapshot(storage))) throw new PortfolioVaultMigrationError('conflict');
  return result;
}
async function verifySources(storage: StoragePort, expected: SourceFingerprint[]): Promise<void> {
  if (JSON.stringify(await fingerprintSources(storage)) !== JSON.stringify(expected)) throw new PortfolioVaultMigrationError('conflict');
}

interface Intent {
  phase: 'prepared' | 'confirmed'; expectedUpdatedAt: string | null; payload: PortfolioVaultPayload;
  sources: SourceFingerprint[];
}
function parseIntent(value: unknown): Intent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PortfolioVaultMigrationError('invalid_intent');
  const body = value as Record<string, unknown>;
  const payload = normalizeLosslessPortfolioVaultPayload(body.payload);
  if (Object.keys(body).length !== 4 || !payload?.privateState
    || !Array.isArray(body.sources) || !body.sources.every(source => source && typeof source === 'object'
      && Object.keys(source).length === 2 && typeof source.key === 'string' && sourceKey(source.key)
      && typeof source.digest === 'string' && /^[a-f0-9]{64}$/.test(source.digest))
    || new Set(body.sources.map(source => source.key)).size !== body.sources.length
    || (body.phase !== 'prepared' && body.phase !== 'confirmed')
    || (body.expectedUpdatedAt !== null && (typeof body.expectedUpdatedAt !== 'string'
      || !Number.isFinite(Date.parse(body.expectedUpdatedAt))))) throw new PortfolioVaultMigrationError('invalid_intent');
  return { phase: body.phase, expectedUpdatedAt: body.expectedUpdatedAt as string | null, payload,
    sources: body.sources as SourceFingerprint[] };
}
async function sealIntent(key: PortfolioVaultKey, intent: Intent) {
  const bytes = new TextEncoder().encode(JSON.stringify(parseIntent(intent)));
  try { return await encryptPortfolioRecord(key, { ownerId: key.ownerId, purpose: 'backup', revision: 1 }, bytes); }
  finally { bytes.fill(0); }
}
async function openIntent(key: PortfolioVaultKey, journal: Journal): Promise<Intent> {
  const bytes = await decryptPortfolioRecord(key, { ownerId: key.ownerId, purpose: 'backup', revision: 1 }, journal.record);
  try { return parseIntent(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))); }
  finally { bytes.fill(0); }
}

/** payload must be the explicitly reconciled cloud/local data, including every
 * private field. This function does not infer ownership or choose conflict sides.
 */
export async function preparePortfolioVaultMigration(input: {
  key: PortfolioVaultKey; protectedKey: ProtectedPortfolioKey; descriptor: PortfolioPasskeyDescriptor;
  payload: PortfolioVaultPayload; expectedUpdatedAt: string | null;
  verifySourceSnapshot?: () => void;
}, storage: StoragePort, exclusive: MigrationLock = browserLock): Promise<void> {
  owner(input.key.ownerId);
  let payload: PortfolioVaultPayload | null;
  try { payload = normalizeLosslessPortfolioVaultPayload(JSON.parse(JSON.stringify(input.payload))); }
  catch { throw new PortfolioVaultMigrationError('invalid_intent'); }
  if (!payload?.privateState) throw new PortfolioVaultMigrationError('invalid_intent');
  // Freeze caller-owned fields before any asynchronous boundary.
  const protectedKey = parseProtectedPortfolioKey(input.protectedKey);
  const descriptor = parsePortfolioPasskeyDescriptor(input.descriptor);
  const { key, expectedUpdatedAt, verifySourceSnapshot } = input;
  if (key.id !== protectedKey.keyId) throw new PortfolioVaultMigrationError('invalid_intent');
  return exclusive(key.ownerId, async () => {
    if (read(storage, key.ownerId) !== null) throw new PortfolioVaultMigrationError('pending_migration');
    const verifyReviewed = () => {
      try { verifySourceSnapshot?.(); }
      catch { throw new PortfolioVaultMigrationError('conflict'); }
    };
    verifyReviewed();
    const sources = await fingerprintSources(storage);
    const record = await sealIntent(key, { phase: 'prepared', expectedUpdatedAt, payload, sources });
    const journal = parse(JSON.stringify({ format: 'joobi-vault-migration-v1', ownerId: key.ownerId,
      protectedKey, descriptor, record }), key.ownerId);
    await verifySources(storage, sources);
    verifyReviewed();
    persist(storage, journal);
    // Read actual persisted bytes, not the object that was intended for storage.
    const stored = parse(read(storage, key.ownerId)!, key.ownerId);
    if (portfolioVaultPayloadSignature((await openIntent(key, stored)).payload)
      !== portfolioVaultPayloadSignature(payload)) throw new PortfolioVaultMigrationError('unverified');
  });
}

/** Resumes after reload/network loss using only the persisted envelope and the
 * user's passkey. A successful/ambiguous write is always followed by read and
 * authenticated decryption. No raw server responses reach errors or logs.
 */
export async function commitPortfolioVaultMigration(ownerId: string, storage: StoragePort,
  rpc: PortfolioVaultRpc, unlock: Unlock, exclusive: MigrationLock = browserLock): Promise<{ status: 'confirmed' }> {
  owner(ownerId);
  return exclusive(ownerId, async () => {
    const text = read(storage, ownerId);
    if (!text) throw new PortfolioVaultMigrationError('invalid_intent');
    const journal = parse(text, ownerId);
    try {
      const key = await unlock(ownerId, journal.protectedKey, journal.descriptor);
      if (key.ownerId !== ownerId || key.id !== journal.protectedKey.keyId) throw new PortfolioVaultMigrationError('unverified');
      const intent = await openIntent(key, journal);
      const { payload } = intent;
      if (!payload.privateState) throw new PortfolioVaultMigrationError('invalid_intent');
      const signature = portfolioVaultPayloadSignature(payload);
      await verifySources(storage, intent.sources);
      let remote = await readPortfolioVault(rpc, ownerId);
      if (remote.status !== 'sealed') {
        // A confirmed migration may never downgrade/reinitialize a deleted row.
        if (intent.phase === 'confirmed') throw new PortfolioVaultMigrationError('unverified');
        if ((remote.status === 'empty') !== (intent.expectedUpdatedAt === null)) throw new PortfolioVaultMigrationError('conflict');
        await verifySources(storage, intent.sources);
        try {
          const result = await initializePortfolioVault(rpc, key, journal.protectedKey, journal.descriptor,
            payload, intent.expectedUpdatedAt, async (envelope, descriptor) => {
              const reopened = await unlock(ownerId, envelope, descriptor);
              await verifySources(storage, intent.sources);
              return reopened;
            });
          if (result.status === 'conflict' || result.status === 'disabled') throw new PortfolioVaultMigrationError(result.status);
        } catch (error) {
          if (error instanceof PortfolioVaultMigrationError) throw error;
          // Includes ambiguous commit: the durable journal remains recoverable.
          // A failed recovery proof cannot write; subsequent read still cannot
          // confirm anything without matching ciphertext and key below.
        }
        remote = await readPortfolioVault(rpc, ownerId);
      }
      if (remote.status !== 'sealed' || remote.revision !== 1
        || JSON.stringify(remote.protectedKey) !== JSON.stringify(journal.protectedKey)
        || JSON.stringify(remote.descriptor) !== JSON.stringify(journal.descriptor)) throw new PortfolioVaultMigrationError('unverified');
      const confirmed = await openPortfolioPayload(key, { ownerId, purpose: 'portfolio', revision: remote.revision }, remote.record);
      if (portfolioVaultPayloadSignature(confirmed) !== signature) throw new PortfolioVaultMigrationError('unverified');
      await verifySources(storage, intent.sources);
      if (read(storage, ownerId) !== text) throw new PortfolioVaultMigrationError('conflict');
      const record = await sealIntent(key, { ...intent, phase: 'confirmed' });
      if (read(storage, ownerId) !== text) throw new PortfolioVaultMigrationError('conflict');
      persist(storage, { ...journal, record });
      return { status: 'confirmed' };
    } catch (error) {
      if (error instanceof PortfolioVaultMigrationError) throw error;
      throw new PortfolioVaultMigrationError('unavailable');
    }
  });
}
