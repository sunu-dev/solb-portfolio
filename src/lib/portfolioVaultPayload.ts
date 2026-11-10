import { normalizePortfolioSyncPayload, type PortfolioSyncPayload } from './portfolioSyncOutbox';
import {
  decryptPortfolioRecord, encryptPortfolioRecord, PortfolioVaultError,
  type EncryptedPortfolioRecord, type PortfolioRecordContext, type PortfolioVaultKey,
} from './portfolioVaultCrypto';

/** Preserve the existing sync payload contract, including snapshots and restore history.
 * Decryption/validation errors throw; callers must never treat them as an empty account.
 */
export async function sealPortfolioPayload(
  key: PortfolioVaultKey, context: PortfolioRecordContext, payload: PortfolioSyncPayload,
): Promise<EncryptedPortfolioRecord> {
  let encoded: Uint8Array<ArrayBuffer>;
  try {
    const normalized = normalizePortfolioSyncPayload(payload);
    if (!normalized) throw new Error();
    encoded = new TextEncoder().encode(JSON.stringify(normalized));
  } catch { throw new PortfolioVaultError('invalid_record'); }
  try { return await encryptPortfolioRecord(key, context, encoded); }
  finally { encoded.fill(0); }
}

export async function openPortfolioPayload(
  key: PortfolioVaultKey, context: PortfolioRecordContext, stored: unknown,
): Promise<PortfolioSyncPayload> {
  const plaintext = await decryptPortfolioRecord(key, context, stored);
  try {
    const normalized = normalizePortfolioSyncPayload(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext)));
    if (!normalized) throw new Error();
    return normalized;
  } catch { throw new PortfolioVaultError('invalid_record'); }
  finally { plaintext.fill(0); }
}
