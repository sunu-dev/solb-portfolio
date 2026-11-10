import { describe, expect, it, vi } from 'vitest';
import { PortfolioVaultAccess } from '@/lib/portfolioVaultAccess';
import { markProtectedPortfolioOwner } from '@/lib/portfolioVaultPolicy';
import type { PortfolioVaultRpc } from '@/lib/portfolioVaultSync';
import { createPortfolioVaultKey } from '@/lib/portfolioVaultCrypto';
import { sealPortfolioPayload } from '@/lib/portfolioVaultPayload';
import { PORTFOLIO_UNLOCK_FORMAT } from '@/lib/portfolioVaultPasskey';

function fixture() {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); } };
  const rpc = vi.fn<PortfolioVaultRpc>();
  return { storage, rpc, access: new PortfolioVaultAccess(rpc, storage), owner: crypto.randomUUID() };
}
describe('server-authoritative portfolio entry gate', () => {
  it.each([false, true])('recognizes sealed records on a fresh device; storage denied: %s', async denied => {
    const f = fixture();
    const { key, protectedKey } = await createPortfolioVaultKey(f.owner, crypto.getRandomValues(new Uint8Array(32)));
    const record = await sealPortfolioPayload(key, { ownerId: f.owner, purpose: 'portfolio', revision: 1 },
      { stocks: { investing: [], watching: [], sold: [] }, snapshots: [], history: [] });
    f.rpc.mockResolvedValue({ data: { status: 'sealed', revision: 1, record, protectedKey,
      descriptor: { format: PORTFOLIO_UNLOCK_FORMAT, credentialId: 'YWJj', input: Buffer.alloc(32, 2).toString('base64url') } }, error: null });
    if (denied) f.storage.setItem = () => { throw new Error('quota'); };
    await f.access.check(f.owner);
    expect(f.access.getSnapshot()).toEqual({ status: denied ? 'unavailable' : 'locked', ownerId: f.owner });
    expect(JSON.stringify(f.access.getSnapshot())).not.toContain('protectedKey');
  });
  it.each(['empty', 'legacy'])('requires migration for %s, never authorizes plaintext writes', async status => {
    const f = fixture();
    f.rpc.mockResolvedValue({ data: { status }, error: null });
    await f.access.check(f.owner);
    expect(f.access.getSnapshot()).toEqual({ status: 'migration-required', ownerId: f.owner });
    expect(f.rpc.mock.calls.map(call => call[0])).toEqual(['read_portfolio_vault_v1']);
  });
  it.each(['empty', 'legacy'])('rejects downgrade of a known protected account to %s', async status => {
    const f = fixture();
    markProtectedPortfolioOwner(f.owner, f.storage);
    f.rpc.mockResolvedValue({ data: { status }, error: null });
    await f.access.check(f.owner);
    expect(f.access.getSnapshot().status).toBe('unavailable');
  });
  it('fails closed on missing RPC, network failure and malformed responses', async () => {
    const f = fixture();
    f.rpc.mockRejectedValueOnce(new Error('private detail'))
      .mockResolvedValueOnce({ data: null, error: { code: 'missing' } })
      .mockResolvedValueOnce({ data: { status: 'unknown' }, error: null });
    for (let i = 0; i < 3; i++) {
      await f.access.check(f.owner);
      expect(f.access.getSnapshot()).toEqual({ status: 'unavailable', ownerId: f.owner });
    }
  });
  it('ignores late results after account change and reset', async () => {
    const f = fixture();
    let finish!: (value: { data: unknown; error: null }) => void;
    f.rpc.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
      .mockResolvedValue({ data: { status: 'legacy' }, error: null });
    const pending = f.access.check(f.owner);
    const next = crypto.randomUUID();
    await f.access.check(next);
    finish({ data: { status: 'empty' }, error: null });
    await pending;
    expect(f.access.getSnapshot()).toEqual({ status: 'migration-required', ownerId: next });
    f.rpc.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const resetting = f.access.check(next);
    f.access.reset();
    finish({ data: { status: 'legacy' }, error: null });
    await resetting;
    expect(f.access.getSnapshot()).toEqual({ status: 'idle' });
  });
  it('rechecks protection added by another tab during the request', async () => {
    const f = fixture();
    f.rpc.mockImplementation(async () => {
      markProtectedPortfolioOwner(f.owner, f.storage);
      return { data: { status: 'legacy' }, error: null };
    });
    await f.access.check(f.owner);
    expect(f.access.getSnapshot().status).toBe('unavailable');
  });
  it('does not query when local protection cannot be read', async () => {
    const f = fixture();
    f.storage.getItem = () => { throw new Error('denied'); };
    await f.access.check(f.owner);
    expect(f.access.getSnapshot().status).toBe('unavailable');
    expect(f.rpc).not.toHaveBeenCalled();
  });
});
