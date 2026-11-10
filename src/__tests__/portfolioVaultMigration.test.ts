import { describe, expect, it, vi } from 'vitest';
import { preparePortfolioVaultMigration, commitPortfolioVaultMigration, PORTFOLIO_MIGRATION_PREFIX,
  type MigrationLock } from '@/lib/portfolioVaultMigration';
import { createPortfolioVaultKey, unlockPortfolioVaultKey } from '@/lib/portfolioVaultCrypto';
import { PORTFOLIO_UNLOCK_FORMAT } from '@/lib/portfolioVaultPasskey';
import { openPortfolioPayload } from '@/lib/portfolioVaultPayload';
import type { PortfolioVaultRpc } from '@/lib/portfolioVaultSync';

const immediate: MigrationLock = async (_owner, work) => work();
async function fixture() {
  const ownerId = crypto.randomUUID();
  const material = crypto.getRandomValues(new Uint8Array(32));
  const made = await createPortfolioVaultKey(ownerId, material);
  const descriptor = { format: PORTFOLIO_UNLOCK_FORMAT, credentialId: 'YWJj', input: Buffer.alloc(32, 2).toString('base64url') } as const;
  const payload = { stocks: { investing: [{ symbol: 'PRIVATE_MIGRATION', avgCost: 234.75, shares: 3, targetReturn: 0 }], watching: [], sold: [] }, snapshots: [], history: [],
    privateState: { customEvents: [], recentSymbols: [], lastImportCheckpoint: null, investorType: 'diversified' as const, investorTypeSetAt: null } };
  const values = new Map([['solb-portfolio-storage', 'OLD_SOURCE_MUST_REMAIN']]);
  const storage = { get length() { return values.size; }, key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const input = { ...made, descriptor, payload, expectedUpdatedAt: '2026-10-30T01:00:00.123456+00:00' };
  let remote: unknown = { status: 'legacy' };
  let ambiguous = false;
  const rpc = vi.fn<PortfolioVaultRpc>(async (name, args) => {
    if (name === 'read_portfolio_vault_v1') return { data: remote, error: null };
    expect(name).toBe('initialize_portfolio_vault_v1');
    expect(values.has(PORTFOLIO_MIGRATION_PREFIX + ownerId)).toBe(true);
    expect(args.p_expected_updated_at).toBe(input.expectedUpdatedAt);
    remote = { status: 'sealed', revision: 1, record: args.p_record, protectedKey: args.p_protected_key, descriptor: args.p_descriptor };
    if (ambiguous) throw new Error('private provider message');
    return { data: { status: 'ok', revision: 1 }, error: null };
  });
  const unlock = vi.fn(async (id, envelope) => unlockPortfolioVaultKey(id, envelope, material));
  const prepare = () => preparePortfolioVaultMigration(input, storage, immediate);
  const commit = () => commitPortfolioVaultMigration(ownerId, storage, rpc, unlock, immediate);
  return { ownerId, input, storage, values, rpc, unlock, prepare, commit,
    setRemote: (value: unknown) => { remote = value; }, getRemote: () => remote,
    loseResponse: () => { ambiguous = true; } };
}

describe('resumable encrypted migration intent', () => {
  it.each(['edit', 'delete', 'new-source'] as const)('refuses migration after a concurrent local %s', async change => {
    const f = await fixture(); await f.prepare();
    if (change === 'edit') f.values.set('solb-portfolio-storage', 'NEW_UNSAVED_PRIVATE_EDIT');
    if (change === 'delete') f.values.delete('solb-portfolio-storage');
    if (change === 'new-source') f.values.set('solb_portfolio_recovery_v1:new-source', 'NEW_RECOVERY');
    await expect(f.commit()).rejects.toMatchObject({ code: 'conflict' });
    expect(f.rpc).not.toHaveBeenCalled();
    expect(f.values.has(PORTFOLIO_MIGRATION_PREFIX + f.ownerId)).toBe(true);
  });
  it('checks local sources again after a slow remote read before replacing the row', async () => {
    const f = await fixture(); await f.prepare();
    f.rpc.mockImplementation(async () => {
      f.values.set('solb-portfolio-storage', 'EDIT_DURING_READ');
      return { data: { status: 'legacy' }, error: null };
    });
    await expect(f.commit()).rejects.toMatchObject({ code: 'conflict' });
    expect(f.rpc.mock.calls.map(call => call[0])).toEqual(['read_portfolio_vault_v1']);
  });
  it('never initializes if another tab edits while the recovery passkey prompt is open', async () => {
    const f = await fixture(); await f.prepare();
    const original = f.unlock.getMockImplementation()!;
    f.unlock.mockImplementation(async (id, envelope) => {
      const key = await original(id, envelope);
      if (f.unlock.mock.calls.length === 2) f.values.set('solb-portfolio-storage', 'EDIT_DURING_PASSKEY');
      return key;
    });
    await expect(f.commit()).rejects.toMatchObject({ code: 'unverified' });
    expect(f.rpc.mock.calls.every(call => call[0] === 'read_portfolio_vault_v1')).toBe(true);
    expect(f.values.get('solb-portfolio-storage')).toBe('EDIT_DURING_PASSKEY');
  });
  it('persists only ciphertext before CAS, reopens the key, verifies server bytes, and preserves old sources', async () => {
    const f = await fixture();
    await f.prepare();
    expect(f.rpc).not.toHaveBeenCalled();
    const journal = f.storage.getItem(PORTFOLIO_MIGRATION_PREFIX + f.ownerId)!;
    for (const value of ['PRIVATE_MIGRATION', '234.75', f.input.expectedUpdatedAt, 'prepared']) expect(journal).not.toContain(value);
    expect(await f.commit()).toEqual({ status: 'confirmed' });
    expect(f.unlock).toHaveBeenCalledTimes(2);
    expect(f.rpc.mock.calls.map(call => call[0])).toEqual(['read_portfolio_vault_v1', 'initialize_portfolio_vault_v1', 'read_portfolio_vault_v1']);
    expect(f.storage.getItem('solb-portfolio-storage')).toBe('OLD_SOURCE_MUST_REMAIN');
    const remote = f.getRemote() as { record: unknown };
    expect(await openPortfolioPayload(f.input.key, { ownerId: f.ownerId, purpose: 'portfolio', revision: 1 }, remote.record)).toEqual(f.input.payload);
  });
  it('recovers a committed write whose response was lost without a second initialization', async () => {
    const f = await fixture(); await f.prepare(); f.loseResponse();
    await expect(f.commit()).resolves.toEqual({ status: 'confirmed' });
    await expect(f.commit()).resolves.toEqual({ status: 'confirmed' });
    expect(f.rpc.mock.calls.filter(call => call[0] === 'initialize_portfolio_vault_v1')).toHaveLength(1);
  });
  it('does not overwrite a pending intent with a new key or payload', async () => {
    const f = await fixture(); await f.prepare();
    const before = f.storage.getItem(PORTFOLIO_MIGRATION_PREFIX + f.ownerId);
    await expect(f.prepare()).rejects.toMatchObject({ code: 'pending_migration' });
    expect(f.storage.getItem(PORTFOLIO_MIGRATION_PREFIX + f.ownerId)).toBe(before);
  });
  it('keeps intent recoverable when confirmation persistence fails', async () => {
    const f = await fixture(); await f.prepare();
    const write = f.storage.setItem;
    f.storage.setItem = () => { throw new Error('quota'); };
    await expect(f.commit()).rejects.toMatchObject({ code: 'storage_unavailable' });
    f.storage.setItem = write;
    await expect(f.commit()).resolves.toEqual({ status: 'confirmed' });
    expect(f.rpc.mock.calls.filter(call => call[0] === 'initialize_portfolio_vault_v1')).toHaveLength(1);
  });
  it.each(['conflict', 'disabled'])('preserves journal and source after %s', async status => {
    const f = await fixture(); await f.prepare();
    f.rpc.mockImplementation(async name => ({ data: name === 'read_portfolio_vault_v1' ? { status: 'legacy' } : { status }, error: null }));
    await expect(f.commit()).rejects.toMatchObject({ code: status });
    expect(f.storage.getItem(PORTFOLIO_MIGRATION_PREFIX + f.ownerId)).not.toBeNull();
    expect(f.storage.getItem('solb-portfolio-storage')).toBe('OLD_SOURCE_MUST_REMAIN');
  });
  it('does not initialize after failed key recovery', async () => {
    const f = await fixture(); await f.prepare();
    f.unlock.mockRejectedValue(new Error('private key detail'));
    await expect(f.commit()).rejects.toMatchObject({ code: 'unavailable', message: 'unavailable' });
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it('does not reinitialize a confirmed account after server row deletion', async () => {
    const f = await fixture(); await f.prepare(); await f.commit();
    f.rpc.mockClear(); f.setRemote({ status: 'empty' });
    await expect(f.commit()).rejects.toMatchObject({ code: 'unverified' });
    expect(f.rpc.mock.calls.map(call => call[0])).toEqual(['read_portfolio_vault_v1']);
  });
  it('rejects tampered intent metadata and ciphertext before server writes', async () => {
    const f = await fixture(); await f.prepare();
    const journalKey = PORTFOLIO_MIGRATION_PREFIX + f.ownerId;
    const original = f.storage.getItem(journalKey)!;
    const modified = JSON.parse(original);
    modified.expectedUpdatedAt = '2026-12-31';
    f.storage.setItem(journalKey, JSON.stringify(modified));
    await expect(f.commit()).rejects.toMatchObject({ code: 'invalid_intent' });
    delete modified.expectedUpdatedAt;
    modified.record.ciphertext = (modified.record.ciphertext[0] === 'A' ? 'B' : 'A') + modified.record.ciphertext.slice(1);
    f.storage.setItem(journalKey, JSON.stringify(modified));
    await expect(f.commit()).rejects.toMatchObject({ code: 'unavailable' });
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it('does not trust an ok acknowledgement without matching encrypted readback', async () => {
    const f = await fixture(); await f.prepare();
    f.rpc.mockImplementation(async name => ({ data: name === 'read_portfolio_vault_v1' ? { status: 'legacy' } : { status: 'ok', revision: 1 }, error: null }));
    await expect(f.commit()).rejects.toMatchObject({ code: 'unverified' });
    expect(f.storage.getItem('solb-portfolio-storage')).toBe('OLD_SOURCE_MUST_REMAIN');
  });
  it('stops before writing any journal when storage is unavailable', async () => {
    const f = await fixture();
    f.storage.setItem = () => { throw new Error('quota'); };
    await expect(f.prepare()).rejects.toMatchObject({ code: 'storage_unavailable' });
    expect(f.rpc).not.toHaveBeenCalled();
  });
});
