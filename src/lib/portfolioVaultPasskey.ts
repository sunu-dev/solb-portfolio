/**
 * User-side key unlocking, NOT application authentication. Kakao/Supabase still
 * authorizes account access. No credential response/PRF output is serialized or
 * sent to the server. This module is not connected to the production UI.
 *
 * PRF availability and cross-device credential synchronization are different
 * capabilities: a successful call does not prove another device can recover.
 */
import {
  createPortfolioVaultKey, unlockPortfolioVaultKey,
  type PortfolioVaultKey, type ProtectedPortfolioKey,
} from './portfolioVaultCrypto';

export const PORTFOLIO_UNLOCK_FORMAT = 'joobi-webauthn-prf-v1';
export interface PortfolioPasskeyDescriptor {
  format: typeof PORTFOLIO_UNLOCK_FORMAT;
  credentialId: string;
  input: string;
}

export class PortfolioPasskeyError extends Error {
  constructor(readonly code: 'unsupported' | 'cancelled' | 'not_allowed' | 'invalid_descriptor' | 'credential_failed' | 'cannot_unlock',
    readonly operation?: 'create' | 'get') {
    super(code);
    this.name = 'PortfolioPasskeyError';
  }
}

function encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decode(value: unknown, min: number, max: number): Uint8Array<ArrayBuffer> {
  if (typeof value !== 'string' || value.length > Math.ceil(max * 4 / 3) || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new PortfolioPasskeyError('invalid_descriptor');
  }
  try {
    const bytes = Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    if (bytes.length < min || bytes.length > max || encode(bytes) !== value) throw new Error();
    return bytes;
  } catch { throw new PortfolioPasskeyError('invalid_descriptor'); }
}

export function parsePortfolioPasskeyDescriptor(value: unknown): PortfolioPasskeyDescriptor {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PortfolioPasskeyError('invalid_descriptor');
  const row = value as Record<string, unknown>;
  if (Object.keys(row).length !== 3 || row.format !== PORTFOLIO_UNLOCK_FORMAT) {
    throw new PortfolioPasskeyError('invalid_descriptor');
  }
  decode(row.credentialId, 1, 1023);
  decode(row.input, 32, 32);
  return { format: PORTFOLIO_UNLOCK_FORMAT, credentialId: row.credentialId as string, input: row.input as string };
}

function relyingParty(): string {
  if (typeof window === 'undefined' || !window.isSecureContext || !navigator.credentials
    || typeof PublicKeyCredential === 'undefined' || !crypto?.subtle) {
    throw new PortfolioPasskeyError('unsupported');
  }
  // Never accept an RP ID from a DB response or arbitrary caller configuration.
  const { hostname, protocol } = window.location;
  if (hostname === 'joobi.kr' && protocol === 'https:') return hostname;
  if (hostname === 'localhost' && ['http:', 'https:'].includes(protocol)) return hostname;
  throw new PortfolioPasskeyError('unsupported');
}

function safeFailure(error: unknown, operation: 'create' | 'get'): never {
  if (error instanceof PortfolioPasskeyError) throw new PortfolioPasskeyError(error.code, error.operation ?? operation);
  const name = error instanceof Error || (typeof DOMException !== 'undefined' && error instanceof DOMException) ? error.name : '';
  // WebAuthn intentionally does not distinguish cancellation, missing matching
  // credentials, timeouts and some policy refusals through NotAllowedError.
  if (name === 'NotAllowedError') throw new PortfolioPasskeyError('not_allowed', operation);
  if (name === 'AbortError') throw new PortfolioPasskeyError('cancelled', operation);
  if (name === 'NotSupportedError') throw new PortfolioPasskeyError('unsupported', operation);
  throw new PortfolioPasskeyError('credential_failed', operation);
}

async function withMaterial<T>(
  descriptor: { input: string; credentialId?: string }, signal: AbortSignal | undefined,
  consumeMaterial: (material: Uint8Array<ArrayBuffer>, credentialId: string) => Promise<T>,
): Promise<T> {
  const rpId = relyingParty();
  let output: Uint8Array<ArrayBuffer> | undefined;
  try {
    const credential = await navigator.credentials.get({ signal, publicKey: {
      rpId, challenge: crypto.getRandomValues(new Uint8Array(32)), timeout: 60_000,
      userVerification: 'required',
      ...(descriptor.credentialId ? { allowCredentials: [{ type: 'public-key' as const, id: decode(descriptor.credentialId, 1, 1023) }] } : {}),
      extensions: { prf: { eval: { first: decode(descriptor.input, 32, 32) } } },
    } });
    if (!(credential instanceof PublicKeyCredential) || (descriptor.credentialId && credential.id !== descriptor.credentialId)) {
      throw new PortfolioPasskeyError('credential_failed');
    }
    const first = credential.getClientExtensionResults().prf?.results?.first;
    if (!first || first.byteLength !== 32) throw new PortfolioPasskeyError('unsupported');
    output = ArrayBuffer.isView(first)
      ? new Uint8Array(first.buffer as ArrayBuffer, first.byteOffset, first.byteLength)
      : new Uint8Array(first as ArrayBuffer);
    if (signal?.aborted) throw new PortfolioPasskeyError('cancelled');
    const result = await consumeMaterial(output, credential.id);
    if (signal?.aborted) throw new PortfolioPasskeyError('cancelled');
    return result;
  } catch (error) { return safeFailure(error, 'get'); }
  finally { output?.fill(0); }
}

/** Registration only. A UI must use a separate user gesture for the following
 * PRF get ceremony; do not assume the create() gesture survives an await.
 */
export async function registerPortfolioPasskey(signal?: AbortSignal): Promise<PortfolioPasskeyDescriptor> {
  const rpId = relyingParty();
  try {
    const credential = await navigator.credentials.create({ signal, publicKey: {
      rp: { id: rpId, name: '주비' },
      // Do not expose email/nickname/account ID in authenticator labels.
      user: { id: crypto.getRandomValues(new Uint8Array(32)), name: '주비 투자 기록', displayName: '주비 투자 기록' },
      challenge: crypto.getRandomValues(new Uint8Array(32)), timeout: 60_000,
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      attestation: 'none', extensions: { prf: {} },
    } });
    if (!(credential instanceof PublicKeyCredential)) throw new PortfolioPasskeyError('credential_failed');
    if (credential.getClientExtensionResults().prf?.enabled !== true) throw new PortfolioPasskeyError('unsupported');
    if (signal?.aborted) throw new PortfolioPasskeyError('cancelled');
    return parsePortfolioPasskeyDescriptor({
      format: PORTFOLIO_UNLOCK_FORMAT, credentialId: credential.id,
      input: encode(crypto.getRandomValues(new Uint8Array(32))),
    });
  } catch (error) { return safeFailure(error, 'create'); }
}

export async function createPortfolioVaultUsingPasskey(ownerId: string, storedDescriptor: unknown, signal?: AbortSignal) {
  const descriptor = parsePortfolioPasskeyDescriptor(storedDescriptor);
  const result = await withMaterial(descriptor, signal, material => createPortfolioVaultKey(ownerId, material));
  return { ...result, descriptor };
}

/** NEW vault enrollment using an already registered discoverable passkey.
 * This never recovers/replaces an existing vault's key or ciphertext. Useful
 * when registration succeeded but setup was interrupted before a vault existed.
 */
export async function createPortfolioVaultWithSelectedPasskey(ownerId: string, signal?: AbortSignal) {
  const input = encode(crypto.getRandomValues(new Uint8Array(32)));
  return withMaterial({ input }, signal, async (material, credentialId) => {
    const descriptor = parsePortfolioPasskeyDescriptor({ format: PORTFOLIO_UNLOCK_FORMAT, credentialId, input });
    return { ...await createPortfolioVaultKey(ownerId, material), descriptor };
  });
}
/** Convenience for controlled harnesses. Interactive UIs should use registration
 * and createPortfolioVaultUsingPasskey in separate click handlers instead.
 */
export async function createPasskeyPortfolioVault(ownerId: string, signal?: AbortSignal): Promise<{
  key: PortfolioVaultKey; protectedKey: ProtectedPortfolioKey; descriptor: PortfolioPasskeyDescriptor;
}> {
  return createPortfolioVaultUsingPasskey(ownerId, await registerPortfolioPasskey(signal), signal);
}

export async function unlockPasskeyPortfolioVault(
  ownerId: string, protectedKey: unknown, storedDescriptor: unknown, signal?: AbortSignal,
): Promise<PortfolioVaultKey> {
  const descriptor = parsePortfolioPasskeyDescriptor(storedDescriptor);
  return withMaterial(descriptor, signal, async material => {
    try { return await unlockPortfolioVaultKey(ownerId, protectedKey, material); }
    catch { throw new PortfolioPasskeyError('cannot_unlock'); }
  });
}
