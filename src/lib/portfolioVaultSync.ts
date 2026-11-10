/** Encrypted RPC boundary. Staged; the live plaintext hook does not import this. */
import {
  parseEncryptedPortfolioRecord, parseProtectedPortfolioKey,
  type EncryptedPortfolioRecord, type ProtectedPortfolioKey, type PortfolioVaultKey,
} from './portfolioVaultCrypto';
import { parsePortfolioPasskeyDescriptor, type PortfolioPasskeyDescriptor } from './portfolioVaultPasskey';
import { openPortfolioPayload, sealPortfolioPayload, type PortfolioVaultPayload } from './portfolioVaultPayload';

type RpcName = 'read_portfolio_vault_v1' | 'initialize_portfolio_vault_v1' | 'save_portfolio_vault_v1';
export type PortfolioVaultRpc = (name: RpcName, args: Record<string, unknown>) => PromiseLike<{
  data: unknown; error: unknown;
}>;
export class PortfolioVaultSyncError extends Error {
  constructor(readonly code: 'unavailable' | 'invalid_response' | 'invalid_request' | 'recovery_unverified' | 'locked' | 'stale_record' | 'busy') {
    super(code);
    this.name = 'PortfolioVaultSyncError';
  }
}
export interface SealedPortfolio {
  status: 'sealed'; revision: number; record: EncryptedPortfolioRecord;
  protectedKey: ProtectedPortfolioKey; descriptor: PortfolioPasskeyDescriptor;
}
type WriteResult = { status: 'ok'; revision: number } | { status: 'conflict' } | { status: 'disabled' };

function owner(value: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new PortfolioVaultSyncError('invalid_request');
  }
}
function revision(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
}
function exact(value: unknown, fields: string[]): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field));
}
async function request(rpc: PortfolioVaultRpc, name: RpcName, args: Record<string, unknown>): Promise<unknown> {
  try {
    const response = await rpc(name, args);
    if (response.error) throw new Error();
    return response.data;
  } catch { throw new PortfolioVaultSyncError('unavailable'); }
}
function writeResult(value: unknown, expected: number): WriteResult {
  if (exact(value, ['status']) && (value.status === 'conflict' || value.status === 'disabled')) return { status: value.status };
  if (exact(value, ['status', 'revision']) && value.status === 'ok' && value.revision === expected) {
    return { status: 'ok', revision: expected };
  }
  throw new PortfolioVaultSyncError('invalid_response');
}

export async function readPortfolioVault(rpc: PortfolioVaultRpc, userId: string): Promise<
  SealedPortfolio | { status: 'empty' | 'legacy' }
> {
  owner(userId);
  const row = await request(rpc, 'read_portfolio_vault_v1', { p_user_id: userId });
  if (exact(row, ['status']) && (row.status === 'empty' || row.status === 'legacy')) return { status: row.status };
  if (!exact(row, ['status', 'revision', 'record', 'protectedKey', 'descriptor']) || row.status !== 'sealed' || !revision(row.revision)) {
    throw new PortfolioVaultSyncError('invalid_response');
  }
  try {
    const record = parseEncryptedPortfolioRecord(row.record);
    const protectedKey = parseProtectedPortfolioKey(row.protectedKey);
    if (record.keyId !== protectedKey.keyId) throw new Error();
    return { status: 'sealed', revision: row.revision, record, protectedKey,
      descriptor: parsePortfolioPasskeyDescriptor(row.descriptor) };
  } catch { throw new PortfolioVaultSyncError('invalid_response'); }
}

export async function initializePortfolioVault(
  rpc: PortfolioVaultRpc, key: PortfolioVaultKey, protectedKey: ProtectedPortfolioKey,
  descriptor: PortfolioPasskeyDescriptor, payload: PortfolioVaultPayload,
  expectedLegacyUpdatedAt: string | null,
  reopenKey: (envelope: ProtectedPortfolioKey, descriptor: PortfolioPasskeyDescriptor) => Promise<PortfolioVaultKey>,
): Promise<WriteResult> {
  owner(key.ownerId);
  const envelope = parseProtectedPortfolioKey(protectedKey);
  const unlock = parsePortfolioPasskeyDescriptor(descriptor);
  if (key.id !== envelope.keyId || (expectedLegacyUpdatedAt !== null
    && (typeof expectedLegacyUpdatedAt !== 'string' || !Number.isFinite(Date.parse(expectedLegacyUpdatedAt))))) {
    throw new PortfolioVaultSyncError('invalid_request');
  }
  const context = { ownerId: key.ownerId, purpose: 'portfolio' as const, revision: 1 };
  const record = await sealPortfolioPayload(key, context, payload);
  // A separate unlock must prove the STORED key envelope opens this record,
  // rather than merely reusing the key already in memory. The real enrollment
  // UI must call unlockPasskeyPortfolioVault here; cross-device recovery remains
  // an additional release gate, not established by this callback.
  try { await openPortfolioPayload(await reopenKey(envelope, unlock), context, record); }
  catch { throw new PortfolioVaultSyncError('recovery_unverified'); }
  return writeResult(await request(rpc, 'initialize_portfolio_vault_v1', {
    p_user_id: key.ownerId, p_expected_updated_at: expectedLegacyUpdatedAt,
    p_record: record, p_protected_key: envelope, p_descriptor: unlock,
  }), 1);
}

/** Memory-only unlocked session. Lock/account change invalidates in-flight results.
 * minimumRevision detects rollback only when this device has a trusted prior
 * checkpoint; a new device cannot prove global freshness from the server alone.
 */
export class PortfolioVaultSession {
  #key: PortfolioVaultKey | null;
  #revision: number | null = null;
  #busy = false;

  constructor(key: PortfolioVaultKey, private readonly rpc: PortfolioVaultRpc) {
    owner(key.ownerId);
    this.#key = key;
  }
  lock(): void { this.#key = null; this.#revision = null; }
  get currentRevision(): number | null { return this.#revision; }
  #active(): PortfolioVaultKey {
    if (!this.#key) throw new PortfolioVaultSyncError('locked');
    return this.#key;
  }
  async load(minimumRevision = 1): Promise<PortfolioVaultPayload> {
    const key = this.#active();
    if (this.#busy) throw new PortfolioVaultSyncError('busy');
    if (!revision(minimumRevision)) throw new PortfolioVaultSyncError('invalid_request');
    this.#busy = true;
    try {
      const stored = await readPortfolioVault(this.rpc, key.ownerId);
      this.#active();
      if (stored.status !== 'sealed') throw new PortfolioVaultSyncError('invalid_response');
      if (stored.revision < Math.max(minimumRevision, this.#revision ?? 1)) throw new PortfolioVaultSyncError('stale_record');
      const payload = await openPortfolioPayload(key, {
        ownerId: key.ownerId, purpose: 'portfolio', revision: stored.revision,
      }, stored.record);
      this.#active();
      this.#revision = stored.revision;
      return payload;
    } catch (error) { this.#revision = null; throw error; }
    finally { this.#busy = false; }
  }
  async save(payload: PortfolioVaultPayload): Promise<WriteResult> {
    const key = this.#active();
    if (this.#busy) throw new PortfolioVaultSyncError('busy');
    // A successful authenticated read/decryption is mandatory before ANY write.
    if (this.#revision === null || this.#revision === Number.MAX_SAFE_INTEGER) throw new PortfolioVaultSyncError('invalid_request');
    this.#busy = true;
    try {
      const expected = this.#revision;
      const record = await sealPortfolioPayload(key, {
        ownerId: key.ownerId, purpose: 'portfolio', revision: expected + 1,
      }, payload);
      this.#active();
      const result = writeResult(await request(this.rpc, 'save_portfolio_vault_v1', {
        p_user_id: key.ownerId, p_expected_revision: expected, p_record: record,
      }), expected + 1);
      this.#active();
      if (result.status === 'ok') this.#revision = result.revision;
      // Conflict, disablement or ambiguous errors require a fresh read. Never
      // silently rebase and overwrite another device's newer investment record.
      else this.#revision = null;
      return result;
    } catch (error) { this.#revision = null; throw error; }
    finally { this.#busy = false; }
  }
}
