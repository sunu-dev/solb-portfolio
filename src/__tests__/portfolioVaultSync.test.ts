import { describe, expect, it, vi } from 'vitest';
import { createPortfolioVaultKey, unlockPortfolioVaultKey } from '@/lib/portfolioVaultCrypto';
import { openPortfolioPayload, sealPortfolioPayload } from '@/lib/portfolioVaultPayload';
import { initializePortfolioVault, PortfolioVaultSession, readPortfolioVault, type PortfolioVaultRpc } from '@/lib/portfolioVaultSync';
import { PORTFOLIO_UNLOCK_FORMAT } from '@/lib/portfolioVaultPasskey';
import type { PortfolioSyncPayload } from '@/lib/portfolioSyncOutbox';

const ownerId = crypto.randomUUID();
const otherOwner = crypto.randomUUID();
const payload: PortfolioSyncPayload = {
  stocks: { investing: [{ symbol: 'PRIVATE_FIXTURE', avgCost: 112.75, shares: 3, targetReturn: 10,
    notes: [{ text: 'private synthetic note', emoji: '📝', date: '2026-10-29' }] }], watching: [], sold: [] },
  snapshots: [], history: [],
};
const descriptor = { format: PORTFOLIO_UNLOCK_FORMAT, credentialId: 'YWJj', input: Buffer.alloc(32, 2).toString('base64url') } as const;

async function fixture() {
  const material = crypto.getRandomValues(new Uint8Array(32));
  const { key, protectedKey } = await createPortfolioVaultKey(ownerId, material);
  const record = await sealPortfolioPayload(key, { ownerId, purpose: 'portfolio', revision: 3 }, payload);
  const sealed = { status: 'sealed', revision: 3, record, protectedKey, descriptor };
  const rpc = vi.fn<PortfolioVaultRpc>().mockResolvedValue({ data: sealed, error: null });
  return { key, material, protectedKey, sealed, rpc, session: new PortfolioVaultSession(key, rpc) };
}

describe('encrypted portfolio RPC boundary', () => {
  it('initializes using ciphertext and wrapped key only, preserving exact legacy CAS token', async () => {
    const f = await fixture();
    f.rpc.mockResolvedValueOnce({ data: { status: 'ok', revision: 1 }, error: null });
    const expected = '2026-10-29T00:00:00.123456+00:00';
    expect(await initializePortfolioVault(f.rpc, f.key, f.protectedKey, descriptor, payload, expected,
      envelope => unlockPortfolioVaultKey(ownerId, envelope, f.material)))
      .toEqual({ status: 'ok', revision: 1 });
    const [name, args] = f.rpc.mock.calls[0];
    expect(name).toBe('initialize_portfolio_vault_v1');
    expect(args.p_expected_updated_at).toBe(expected);
    expect(Object.keys(args).sort()).toEqual(['p_user_id', 'p_expected_updated_at', 'p_record', 'p_protected_key', 'p_descriptor'].sort());
    const request = JSON.stringify(args);
    for (const secret of ['PRIVATE_FIXTURE', 'private synthetic note', '112.75', Buffer.from(f.material).toString('base64url')]) {
      expect(request).not.toContain(secret);
    }
    const secondKey = await unlockPortfolioVaultKey(ownerId, args.p_protected_key, f.material);
    expect(await openPortfolioPayload(secondKey, { ownerId, purpose: 'portfolio', revision: 1 }, args.p_record)).toEqual(payload);
  });

  it('does not replace legacy data when its stored key envelope cannot be recovered', async () => {
    const f = await fixture();
    const wrongMaterial = crypto.getRandomValues(new Uint8Array(32));
    await expect(initializePortfolioVault(f.rpc, f.key, f.protectedKey, descriptor, payload, null,
      envelope => unlockPortfolioVaultKey(ownerId, envelope, wrongMaterial)))
      .rejects.toMatchObject({ code: 'recovery_unverified' });
    expect(f.rpc).not.toHaveBeenCalled();
  });

  it('requires a successful read and decryption before writing', async () => {
    const f = await fixture();
    await expect(f.session.save(payload)).rejects.toMatchObject({ code: 'invalid_request' });
    expect(f.rpc).not.toHaveBeenCalled();
    expect(await f.session.load()).toEqual(payload);
    f.rpc.mockResolvedValueOnce({ data: { status: 'ok', revision: 4 }, error: null });
    await expect(f.session.save(payload)).resolves.toEqual({ status: 'ok', revision: 4 });
    const args = f.rpc.mock.calls[1][1];
    expect(args.p_expected_revision).toBe(3);
    expect(await openPortfolioPayload(f.key, { ownerId, purpose: 'portfolio', revision: 4 }, args.p_record)).toEqual(payload);
    expect(f.session.currentRevision).toBe(4);
  });

  it.each(['conflict', 'disabled'])('blocks further saves after %s until a fresh read', async status => {
    const f = await fixture();
    await f.session.load();
    f.rpc.mockResolvedValueOnce({ data: { status }, error: null });
    await expect(f.session.save(payload)).resolves.toEqual({ status });
    await expect(f.session.save(payload)).rejects.toMatchObject({ code: 'invalid_request' });
    expect(f.rpc).toHaveBeenCalledTimes(2);
  });

  it('treats ambiguous network failure as unknown commit, never a plaintext fallback', async () => {
    const f = await fixture();
    await f.session.load();
    f.rpc.mockRejectedValueOnce(new Error('token, private synthetic note'));
    await expect(f.session.save(payload)).rejects.toMatchObject({ code: 'unavailable', message: 'unavailable' });
    await expect(f.session.save(payload)).rejects.toMatchObject({ code: 'invalid_request' });
    expect(f.rpc.mock.calls.map(call => call[0])).toEqual(['read_portfolio_vault_v1', 'save_portfolio_vault_v1']);
  });

  it.each([null, {}, { status: 'empty', stocks: payload.stocks }, { status: 'sealed', revision: 0 }])('does not treat malformed responses as empty records: %j', async data => {
    const f = await fixture();
    f.rpc.mockResolvedValue({ data, error: null });
    await expect(readPortfolioVault(f.rpc, ownerId)).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it.each(['empty', 'legacy'])('keeps %s explicit and cannot overwrite it from a vault session', async status => {
    const f = await fixture();
    f.rpc.mockResolvedValue({ data: { status }, error: null });
    await expect(readPortfolioVault(f.rpc, ownerId)).resolves.toEqual({ status });
    await expect(f.session.load()).rejects.toMatchObject({ code: 'invalid_response' });
    await expect(f.session.save(payload)).rejects.toMatchObject({ code: 'invalid_request' });
  });

  it('rejects wrong owner, tampering and revision rollback without enabling save', async () => {
    const f = await fixture();
    const other = await createPortfolioVaultKey(otherOwner, f.material);
    const wrongSession = new PortfolioVaultSession(other.key, f.rpc);
    await expect(wrongSession.load()).rejects.toMatchObject({ code: 'cannot_decrypt' });
    await expect(f.session.load(4)).rejects.toMatchObject({ code: 'stale_record' });
    await expect(f.session.save(payload)).rejects.toMatchObject({ code: 'invalid_request' });
    f.rpc.mockResolvedValue({ data: { ...f.sealed, revision: 4 }, error: null });
    await expect(f.session.load()).rejects.toMatchObject({ code: 'cannot_decrypt' });
  });

  it('does not keep an earlier save permission after a subsequent failed load', async () => {
    const f = await fixture();
    await f.session.load();
    f.rpc.mockResolvedValueOnce({ data: null, error: { message: 'private server error' } });
    await expect(f.session.load()).rejects.toMatchObject({ code: 'unavailable' });
    await expect(f.session.save(payload)).rejects.toMatchObject({ code: 'invalid_request' });
  });

  it('invalidates in-flight reads when locked or switched to another account', async () => {
    const f = await fixture();
    let resolve!: (value: { data: unknown; error: null }) => void;
    f.rpc.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const pending = f.session.load();
    f.session.lock();
    resolve({ data: f.sealed, error: null });
    await expect(pending).rejects.toMatchObject({ code: 'locked' });
    expect(f.session.currentRevision).toBeNull();
    await expect(f.session.save(payload)).rejects.toMatchObject({ code: 'locked' });
  });

  it('serializes operations and ignores the response to a save completed after locking', async () => {
    const f = await fixture();
    await f.session.load();
    let resolve!: (value: { data: unknown; error: null }) => void;
    f.rpc.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const pending = f.session.save(payload);
    await vi.waitFor(() => expect(f.rpc).toHaveBeenCalledTimes(2));
    await expect(f.session.save(payload)).rejects.toMatchObject({ code: 'busy' });
    await expect(f.session.load()).rejects.toMatchObject({ code: 'busy' });
    f.session.lock();
    resolve({ data: { status: 'ok', revision: 4 }, error: null });
    await expect(pending).rejects.toMatchObject({ code: 'locked' });
    expect(f.session.currentRevision).toBeNull();
  });
});
