import { normalizePortfolioSyncPayload, type PortfolioSyncPayload } from './portfolioSyncOutbox';
import type { PresetEvent } from '@/config/constants';
import type { InvestorType } from '@/config/investorTypes';
import type { PortfolioImportCheckpoint } from './portfolioReconciliation';
import { normalizePortfolioVersions } from './portfolioReconciliation';
import {
  decryptPortfolioRecord, encryptPortfolioRecord, PortfolioVaultError,
  type EncryptedPortfolioRecord, type PortfolioRecordContext, type PortfolioVaultKey,
} from './portfolioVaultCrypto';

/** Personal state that the legacy app kept only in plaintext localStorage. It
 * must move with the encrypted portfolio, not disappear when persistence stops.
 */
export interface PortfolioVaultPrivateState {
  customEvents: PresetEvent[];
  recentSymbols: string[];
  lastImportCheckpoint: PortfolioImportCheckpoint | null;
  investorType: InvestorType;
  investorTypeSetAt: string | null;
}
export interface PortfolioVaultPayload extends PortfolioSyncPayload {
  privateState?: PortfolioVaultPrivateState;
}

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}
function numbers(value: unknown): boolean {
  return object(value) && Object.values(value).every(item => typeof item === 'number' && Number.isFinite(item));
}
function canonical(value: unknown): unknown {
  return Array.isArray(value) ? value.map(canonical)
    : object(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => [key, canonical(child)])) : value;
}
/** Migration must never silently discard data as a side effect of validation. */
export function normalizeLosslessPortfolioVaultPayload(value: unknown): PortfolioVaultPayload | null {
  const normalized = normalizePortfolioVaultPayload(value);
  return normalized && JSON.stringify(canonical(value)) === JSON.stringify(canonical(normalized)) ? normalized : null;
}
function validEvent(value: unknown): value is PresetEvent {
  if (!object(value)) return false;
  const required = ['id', 'name', 'emoji', 'startDate', 'baseDate', 'description', 'insight'];
  const allowed = [...required, 'endDate', 'basePrices', 'baseMacro', 'periodNote', 'periodSource', 'keyFacts', 'precomputed'];
  if (Object.keys(value).some(key => !allowed.includes(key))
    || required.some(key => typeof value[key] !== 'string')
    || (value.endDate !== null && typeof value.endDate !== 'string')
    || !numbers(value.basePrices) || !numbers(value.baseMacro)
    || ['periodNote', 'periodSource'].some(key => value[key] !== undefined && typeof value[key] !== 'string')
    || (value.keyFacts !== undefined && !strings(value.keyFacts))) return false;
  if (value.precomputed !== undefined && (!object(value.precomputed)
    || !Object.values(value.precomputed).every(item => object(item)
      && Object.keys(item).length === 3 && typeof item.maxDrop === 'number' && Number.isFinite(item.maxDrop)
      && typeof item.recovered === 'boolean'
      && (item.recoveryDays === null || (typeof item.recoveryDays === 'number' && Number.isFinite(item.recoveryDays)))))) return false;
  return true;
}

/** Unknown payload versions/fields fail closed. Do not silently drop new private
 * fields when an older client opens or re-saves a newer encrypted record.
 */
export function normalizePortfolioVaultPayload(value: unknown): PortfolioVaultPayload | null {
  try {
    if (!object(value) || Object.keys(value).some(key => !['stocks', 'snapshots', 'history', 'privateState'].includes(key))) return null;
    const base = normalizePortfolioSyncPayload(value);
    if (!base) return null;
    // The legacy normalizer truncates history to 20 and filters malformed
    // entries/fields. Encrypted records must preserve every valid entry and
    // refuse unknown or lossy entries, including when opening newer records.
    const history = value.history as unknown[];
    for (const entry of history) {
      const validated = normalizePortfolioVersions([entry]);
      if (validated.length !== 1 || JSON.stringify(canonical(entry)) !== JSON.stringify(canonical(validated[0]))) return null;
    }
    base.history = JSON.parse(JSON.stringify(history));
    if (!Object.hasOwn(value, 'privateState')) return base;
    const extra = value.privateState;
    const fields = ['customEvents', 'recentSymbols', 'lastImportCheckpoint', 'investorType', 'investorTypeSetAt'];
    if (!object(extra) || Object.keys(extra).length !== fields.length || fields.some(key => !Object.hasOwn(extra, key))
      || !Array.isArray(extra.customEvents) || !extra.customEvents.every(validEvent)
      || !strings(extra.recentSymbols) || typeof extra.investorType !== 'string'
      || !['value', 'growth', 'income', 'momentum', 'diversified'].includes(extra.investorType)
      || (extra.investorTypeSetAt !== null && (typeof extra.investorTypeSetAt !== 'string' || !Number.isFinite(Date.parse(extra.investorTypeSetAt))))) return null;
    const checkpoint = extra.lastImportCheckpoint;
    if (checkpoint !== null && (!object(checkpoint) || Object.keys(checkpoint).length !== 4
      || ['id', 'createdAt', 'source'].some(key => typeof checkpoint[key] !== 'string')
      || !normalizePortfolioSyncPayload({ stocks: checkpoint.stocks, snapshots: [], history: [] }))) return null;
    return { ...base, privateState: JSON.parse(JSON.stringify(extra)) as PortfolioVaultPrivateState };
  } catch { return null; }
}

/** Includes all encrypted personal fields; a cloud acknowledgement must never
 * mistake a changed note/event/checkpoint for an already saved portfolio.
 */
export function portfolioVaultPayloadSignature(payload: PortfolioVaultPayload): string {
  const normalized = normalizePortfolioVaultPayload(payload);
  if (!normalized) throw new PortfolioVaultError('invalid_record');
  return JSON.stringify(canonical(normalized));
}

/** Preserve the existing sync payload contract, including snapshots and restore history.
 * Decryption/validation errors throw; callers must never treat them as an empty account.
 */
export async function sealPortfolioPayload(
  key: PortfolioVaultKey, context: PortfolioRecordContext, payload: PortfolioVaultPayload,
): Promise<EncryptedPortfolioRecord> {
  let encoded: Uint8Array<ArrayBuffer>;
  try {
    const normalized = normalizePortfolioVaultPayload(payload);
    if (!normalized) throw new Error();
    encoded = new TextEncoder().encode(JSON.stringify(normalized));
  } catch { throw new PortfolioVaultError('invalid_record'); }
  try { return await encryptPortfolioRecord(key, context, encoded); }
  finally { encoded.fill(0); }
}

export async function openPortfolioPayload(
  key: PortfolioVaultKey, context: PortfolioRecordContext, stored: unknown,
): Promise<PortfolioVaultPayload> {
  const plaintext = await decryptPortfolioRecord(key, context, stored);
  try {
    const normalized = normalizePortfolioVaultPayload(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext)));
    if (!normalized) throw new Error();
    return normalized;
  } catch { throw new PortfolioVaultError('invalid_record'); }
  finally { plaintext.fill(0); }
}
