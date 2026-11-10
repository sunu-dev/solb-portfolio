import { afterEach, expect, it, vi } from 'vitest';
import { createPasskeyPortfolioVault, unlockPasskeyPortfolioVault, PORTFOLIO_UNLOCK_FORMAT,
  registerPortfolioPasskey, createPortfolioVaultUsingPasskey, createPortfolioVaultWithSelectedPasskey } from '@/lib/portfolioVaultPasskey';

afterEach(() => vi.unstubAllGlobals());
it.each([
  ['NotAllowedError', 'not_allowed'], ['AbortError', 'cancelled'], ['NotSupportedError', 'unsupported'],
])('does not mislabel native %s as an explicit user cancellation', async (name, code) => {
  const failure = vi.fn().mockRejectedValue(new DOMException('sensitive platform details', name));
  vi.stubGlobal('window', { isSecureContext: true, location: { hostname: 'localhost', protocol: 'http:' } });
  vi.stubGlobal('navigator', { credentials: { get: failure, create: failure } });
  vi.stubGlobal('PublicKeyCredential', class {});
  const descriptor = { format: PORTFOLIO_UNLOCK_FORMAT, credentialId: 'YWJj', input: Buffer.alloc(32, 2).toString('base64url') };
  await expect(unlockPasskeyPortfolioVault('synthetic-owner', {}, descriptor)).rejects.toMatchObject({ code, message: code, operation: 'get' });
  await expect(createPasskeyPortfolioVault('synthetic-owner')).rejects.toMatchObject({ code, message: code, operation: 'create' });
});

it('separates registration from PRF get and can reuse a discoverable passkey without registering again', async () => {
  class Credential {
    id = 'YWJj';
    getClientExtensionResults() { return { prf: { enabled: true, results: { first: new Uint8Array(32).fill(7).buffer } } }; }
  }
  const create = vi.fn(async () => new Credential());
  const get = vi.fn(async () => new Credential());
  vi.stubGlobal('window', { isSecureContext: true, location: { hostname: 'localhost', protocol: 'http:' } });
  vi.stubGlobal('navigator', { credentials: { create, get } });
  vi.stubGlobal('PublicKeyCredential', Credential);
  const descriptor = await registerPortfolioPasskey();
  expect(create).toHaveBeenCalledOnce(); expect(get).not.toHaveBeenCalled();
  const first = await createPortfolioVaultUsingPasskey('synthetic-owner', descriptor);
  expect(first.descriptor).toEqual(descriptor);
  expect(first.key.cryptoKey.extractable).toBe(false);
  expect(get).toHaveBeenCalledOnce();
  const reused = await createPortfolioVaultWithSelectedPasskey('synthetic-owner');
  expect(create).toHaveBeenCalledOnce(); expect(get).toHaveBeenCalledTimes(2);
  expect(reused.descriptor.credentialId).toBe(descriptor.credentialId);
  expect(reused.descriptor.input).not.toBe(descriptor.input);
  expect(reused.key.id).not.toBe(first.key.id);
  expect(get.mock.calls[1]).toEqual([expect.objectContaining({ publicKey: expect.objectContaining({ userVerification: 'required' }) })]);
  const last = (get.mock.calls as unknown[][])[1][0] as { publicKey: Record<string, unknown> };
  expect(last.publicKey).not.toHaveProperty('allowCredentials');
});
