/**
 * Browser-side encryption primitives; deliberately not connected to live sync yet.
 * Web Crypto implements AES-GCM, RFC3394 AES-KW and RFC5869 HKDF.
 * unlockMaterial must be 32 bytes from a CSPRNG / verified authenticator PRF,
 * never an account ID, OAuth token, password or PIN. HKDF is not a password KDF.
 * No function persists, transmits or logs keys, unlock material or plaintext.
 */
export const PORTFOLIO_RECORD_FORMAT = 'joobi-portfolio-a256gcm-v1';
export const PORTFOLIO_KEY_FORMAT = 'joobi-portfolio-hkdf-a256kw-v1';
export const MAX_PORTFOLIO_PLAINTEXT_BYTES = 2 * 1024 * 1024;

type Bytes = Uint8Array<ArrayBuffer>;
type VaultErrorCode =
  | 'crypto_unavailable' | 'invalid_context' | 'invalid_key'
  | 'invalid_record' | 'invalid_unlock_material' | 'payload_too_large'
  | 'cannot_unlock' | 'cannot_encrypt' | 'cannot_decrypt';

export class PortfolioVaultError extends Error {
  constructor(readonly code: VaultErrorCode) {
    // Do not attach underlying exceptions / sensitive input to loggable errors.
    super(code);
    this.name = 'PortfolioVaultError';
  }
}

export interface PortfolioVaultKey {
  readonly id: string;
  readonly ownerId: string;
  readonly cryptoKey: CryptoKey;
}

export interface ProtectedPortfolioKey {
  format: typeof PORTFOLIO_KEY_FORMAT;
  keyId: string;
  salt: string;
  wrappedKey: string;
}

export interface PortfolioRecordContext {
  ownerId: string;
  purpose: 'portfolio' | 'outbox' | 'backup';
  /** Caller must obtain/validate the expected revision; AEAD is not replay protection. */
  revision: number;
}

export interface EncryptedPortfolioRecord {
  format: typeof PORTFOLIO_RECORD_FORMAT;
  keyId: string;
  iv: string;
  ciphertext: string;
}

const encoder = new TextEncoder();
const MAX_CIPHERTEXT_BYTES = MAX_PORTFOLIO_PLAINTEXT_BYTES + 16;

function webCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) throw new PortfolioVaultError('crypto_unavailable');
  return globalThis.crypto;
}

function validateOwner(ownerId: string) {
  if (typeof ownerId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(ownerId)) {
    throw new PortfolioVaultError('invalid_context');
  }
}

function validateContext(context: PortfolioRecordContext) {
  if (!context || typeof context !== 'object') throw new PortfolioVaultError('invalid_context');
  validateOwner(context.ownerId);
  if (!['portfolio', 'outbox', 'backup'].includes(context.purpose)
    || !Number.isSafeInteger(context.revision) || context.revision < 1) {
    throw new PortfolioVaultError('invalid_context');
  }
}

function base64url(bytes: Bytes): string {
  let binary = '';
  for (let start = 0; start < bytes.length; start += 8192) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decode(value: unknown, minimum: number, maximum: number, code: VaultErrorCode): Bytes {
  if (typeof value !== 'string' || value.length > Math.ceil(maximum * 4 / 3)
    || !/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) {
    throw new PortfolioVaultError(code);
  }
  let bytes: Bytes;
  try {
    const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
    bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  } catch { throw new PortfolioVaultError(code); }
  if (bytes.length < minimum || bytes.length > maximum || base64url(bytes) !== value) {
    throw new PortfolioVaultError(code);
  }
  return bytes;
}

function exactObject(value: unknown, fields: string[], code: VaultErrorCode): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== fields.length
    || !fields.every(field => Object.hasOwn(value, field))) {
    throw new PortfolioVaultError(code);
  }
  return value as Record<string, unknown>;
}

export function parseProtectedPortfolioKey(value: unknown): ProtectedPortfolioKey {
  const row = exactObject(value, ['format', 'keyId', 'salt', 'wrappedKey'], 'invalid_key');
  if (row.format !== PORTFOLIO_KEY_FORMAT) throw new PortfolioVaultError('invalid_key');
  decode(row.keyId, 16, 16, 'invalid_key');
  decode(row.salt, 32, 32, 'invalid_key');
  decode(row.wrappedKey, 40, 40, 'invalid_key');
  return { format: PORTFOLIO_KEY_FORMAT, keyId: row.keyId as string,
    salt: row.salt as string, wrappedKey: row.wrappedKey as string };
}

/** Validate untrusted storage without decrypting or permitting extra plaintext fields. */
export function parseEncryptedPortfolioRecord(value: unknown): EncryptedPortfolioRecord {
  const row = exactObject(value, ['format', 'keyId', 'iv', 'ciphertext'], 'invalid_record');
  if (row.format !== PORTFOLIO_RECORD_FORMAT) throw new PortfolioVaultError('invalid_record');
  decode(row.keyId, 16, 16, 'invalid_record');
  decode(row.iv, 12, 12, 'invalid_record');
  decode(row.ciphertext, 16, MAX_CIPHERTEXT_BYTES, 'invalid_record');
  return { format: PORTFOLIO_RECORD_FORMAT, keyId: row.keyId as string,
    iv: row.iv as string, ciphertext: row.ciphertext as string };
}

async function wrappingKey(ownerId: string, envelope: ProtectedPortfolioKey, material: Uint8Array) {
  validateOwner(ownerId);
  if (!(material instanceof Uint8Array) || material.length !== 32) {
    throw new PortfolioVaultError('invalid_unlock_material');
  }
  const copy = new Uint8Array(material);
  try {
    const input = await webCrypto().subtle.importKey('raw', copy, 'HKDF', false, ['deriveKey']);
    return await webCrypto().subtle.deriveKey({
      name: 'HKDF', hash: 'SHA-256', salt: decode(envelope.salt, 32, 32, 'invalid_key'),
      info: encoder.encode(JSON.stringify([PORTFOLIO_KEY_FORMAT, ownerId, envelope.keyId])),
    }, input, { name: 'AES-KW', length: 256 }, false, ['wrapKey', 'unwrapKey']);
  } finally { copy.fill(0); }
}

async function unwrap(ownerId: string, envelope: ProtectedPortfolioKey, material: Uint8Array, extractable: boolean) {
  const wrapping = await wrappingKey(ownerId, envelope, material);
  try {
    return await webCrypto().subtle.unwrapKey(
      'raw', decode(envelope.wrappedKey, 40, 40, 'invalid_key'), wrapping, 'AES-KW',
      { name: 'AES-GCM', length: 256 }, extractable, ['encrypt', 'decrypt'],
    );
  } catch { throw new PortfolioVaultError('cannot_unlock'); }
}

function handle(ownerId: string, id: string, cryptoKey: CryptoKey): PortfolioVaultKey {
  return Object.freeze({ ownerId, id, cryptoKey });
}

export async function createPortfolioVaultKey(ownerId: string, unlockMaterial: Uint8Array): Promise<{
  key: PortfolioVaultKey; protectedKey: ProtectedPortfolioKey;
}> {
  validateOwner(ownerId);
  const envelope: ProtectedPortfolioKey = {
    format: PORTFOLIO_KEY_FORMAT,
    keyId: base64url(webCrypto().getRandomValues(new Uint8Array(16))),
    salt: base64url(webCrypto().getRandomValues(new Uint8Array(32))),
    wrappedKey: '',
  };
  const wrapping = await wrappingKey(ownerId, envelope, unlockMaterial);
  // Extractability is confined to creating/rewrapping this envelope, not returned handles.
  const temporary = await webCrypto().subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  envelope.wrappedKey = base64url(new Uint8Array(await webCrypto().subtle.wrapKey('raw', temporary, wrapping, 'AES-KW')));
  return { key: handle(ownerId, envelope.keyId, await unwrap(ownerId, envelope, unlockMaterial, false)), protectedKey: envelope };
}

export async function unlockPortfolioVaultKey(ownerId: string, stored: unknown, unlockMaterial: Uint8Array): Promise<PortfolioVaultKey> {
  const envelope = parseProtectedPortfolioKey(stored);
  return handle(ownerId, envelope.keyId, await unwrap(ownerId, envelope, unlockMaterial, false));
}

/** Add/change an unlock mechanism without exposing the data key or re-encrypting records.
 * This does NOT revoke old copies of the wrapped key. Revocation needs data-key rotation.
 */
export async function rewrapPortfolioVaultKey(
  ownerId: string, stored: unknown, previousMaterial: Uint8Array, nextMaterial: Uint8Array,
): Promise<ProtectedPortfolioKey> {
  const previous = parseProtectedPortfolioKey(stored);
  const next: ProtectedPortfolioKey = {
    ...previous, salt: base64url(webCrypto().getRandomValues(new Uint8Array(32))), wrappedKey: '',
  };
  const wrapping = await wrappingKey(ownerId, next, nextMaterial);
  const temporary = await unwrap(ownerId, previous, previousMaterial, true);
  next.wrappedKey = base64url(new Uint8Array(await webCrypto().subtle.wrapKey('raw', temporary, wrapping, 'AES-KW')));
  return next;
}

function validateHandle(key: PortfolioVaultKey, context: PortfolioRecordContext) {
  validateContext(context);
  if (!key || key.ownerId !== context.ownerId || !key.cryptoKey
    || key.cryptoKey.type !== 'secret' || key.cryptoKey.extractable
    || key.cryptoKey.algorithm.name !== 'AES-GCM'
    || (key.cryptoKey.algorithm as AesKeyAlgorithm).length !== 256) {
    throw new PortfolioVaultError('invalid_key');
  }
  decode(key.id, 16, 16, 'invalid_key');
}

function authenticatedContext(keyId: string, context: PortfolioRecordContext): Bytes {
  return encoder.encode(JSON.stringify([
    PORTFOLIO_RECORD_FORMAT, context.ownerId, keyId, context.purpose, context.revision,
  ]));
}

export async function encryptPortfolioRecord(
  key: PortfolioVaultKey, context: PortfolioRecordContext, plaintext: Uint8Array,
): Promise<EncryptedPortfolioRecord> {
  validateHandle(key, context);
  if (!(plaintext instanceof Uint8Array)) throw new PortfolioVaultError('invalid_record');
  if (plaintext.byteLength > MAX_PORTFOLIO_PLAINTEXT_BYTES) throw new PortfolioVaultError('payload_too_large');
  const iv = webCrypto().getRandomValues(new Uint8Array(12));
  const copy = new Uint8Array(plaintext);
  try {
    const encrypted = await webCrypto().subtle.encrypt({ name: 'AES-GCM', iv,
      additionalData: authenticatedContext(key.id, context), tagLength: 128 }, key.cryptoKey, copy);
    return { format: PORTFOLIO_RECORD_FORMAT, keyId: key.id, iv: base64url(iv), ciphertext: base64url(new Uint8Array(encrypted)) };
  } catch { throw new PortfolioVaultError('cannot_encrypt'); }
  finally { copy.fill(0); }
}

export async function decryptPortfolioRecord(
  key: PortfolioVaultKey, context: PortfolioRecordContext, stored: unknown,
): Promise<Bytes> {
  validateHandle(key, context);
  const record = parseEncryptedPortfolioRecord(stored);
  if (record.keyId !== key.id) throw new PortfolioVaultError('cannot_decrypt');
  try {
    const plaintext = await webCrypto().subtle.decrypt({ name: 'AES-GCM',
      iv: decode(record.iv, 12, 12, 'invalid_record'),
      additionalData: authenticatedContext(key.id, context), tagLength: 128 },
    key.cryptoKey, decode(record.ciphertext, 16, MAX_CIPHERTEXT_BYTES, 'invalid_record'));
    return new Uint8Array(plaintext);
  } catch { throw new PortfolioVaultError('cannot_decrypt'); }
}
