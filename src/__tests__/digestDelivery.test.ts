import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ send: vi.fn(), push: vi.fn(), alert: vi.fn(), rpc: vi.fn(), removeEndpoint: vi.fn() }));
vi.mock('@/utils/email', () => ({ sendEmail: mocks.send }));
vi.mock('web-push', () => ({ default: { setVapidDetails: vi.fn(), sendNotification: mocks.push } }));
vi.mock('@/lib/cronAlert', () => ({ sendCronAlert: mocks.alert }));
vi.mock('@/lib/supabaseServer', () => ({ requireServiceClient: vi.fn() }));
import { attemptDigest, processDigestQueue, queueDigest, type DigestDelivery } from '@/lib/digestDelivery';
const row: DigestDelivery = { id: 'same-message-id', user_id: 'test-user', channel: 'email', attempts: 1,
  deadline_at: '2026-10-22T08:00:00Z', payload: { email: { to: 'test@example.test', subject: 'test', text: 'fixed body' } } };
function claims(rows: DigestDelivery[], failures = 0) {
  mocks.rpc.mockImplementation(async (name: string) => ({ data: name === 'claim_digest_failure_report' ? failures : rows, error: null }));
}
function database(options: { consent?: boolean; recipient?: string; duplicate?: boolean; legacy?: boolean; finalError?: boolean } = {}) {
  const update = vi.fn();
  const db = {
    rpc: mocks.rpc,
    auth: { admin: { getUserById: vi.fn(async () => ({ data: { user: { email: options.recipient || 'test@example.test' } } })) } },
    from: vi.fn((table: string) => {
      const builder = {
        select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
        limit: vi.fn(async () => ({ data: options.legacy ? [{ user_id: 'test-user' }] : [], error: null })),
        maybeSingle: vi.fn(async () => ({ data: table === 'email_subscriptions' ? { morning_brief_enabled: options.consent !== false } : { subscription: { endpoint: 'https://example.test' } }, error: null })),
        insert: vi.fn(async () => ({ error: options.duplicate ? { code: '23505' } : null })),
        delete: vi.fn(() => ({ eq: () => ({ contains: mocks.removeEndpoint }) })),
        update: vi.fn((values: unknown) => { update(values); return { eq: () => ({ eq: () => ({ eq: () => ({ select: async () => ({ data: [{ id: row.id }], error: options.finalError ? {} : null }) }) }) }) }; }),
      };
      return builder;
    }),
  };
  return { db: db as unknown as Parameters<typeof attemptDigest>[1], update };
}
beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-22T02:00:00Z')); mocks.send.mockResolvedValue({ ok: true, id: 'provider-id' }); claims([]); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
describe('channel-aware digest delivery', () => {
  it('pauses producers, queue claims and direct retries without reading private rows or contacting providers', async () => {
    vi.stubEnv('PORTFOLIO_PRIVATE_NOTIFICATIONS_PAUSED', 'on');
    const { db } = database();
    expect(await queueDigest(db, { userId: 'test-user', type: 'morning_brief', date: '2026-10-22', channel: 'email', payload: row.payload })).toBe(false);
    expect(await processDigestQueue(db)).toMatchObject({ sent: 0, skipped: 'private-notifications-paused' });
    expect(await attemptDigest(row, db)).toMatchObject({ status: 'retryable', error: 'private-notifications-paused' });
    expect(db.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });
  it('rechecks pause after an email delay before the provider call', async () => {
    const { db } = database();
    const result = await attemptDigest(row, db, async () => { vi.stubEnv('PORTFOLIO_PRIVATE_NOTIFICATIONS_PAUSED', 'on'); });
    expect(result).toMatchObject({ status: 'retryable', error: 'private-notifications-paused' });
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it('uses the same provider key and body on an email retry', async () => {
    const { db } = database();
    mocks.send.mockResolvedValueOnce({ ok: false, retryable: true, error: 'http_503' });
    expect((await attemptDigest(row, db)).status).toBe('retryable');
    expect((await attemptDigest({ ...row, attempts: 2 }, db)).status).toBe('sent');
    expect(mocks.send.mock.calls[0][0]).toEqual(mocks.send.mock.calls[1][0]);
    expect(mocks.send.mock.calls[0][0].idempotencyKey).toBe('joobi-digest/same-message-id');
  });
  it('rechecks unsubscribe and changed email address before sending a queued message', async () => {
    expect((await attemptDigest(row, database({ consent: false }).db)).status).toBe('cancelled');
    expect((await attemptDigest(row, database({ recipient: 'changed@example.test' }).db)).status).toBe('cancelled');
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it('never sends an expired message', async () => {
    expect((await attemptDigest({ ...row, deadline_at: '2026-10-22T00:00:00Z' }, database().db)).status).toBe('failed');
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it('does not overwrite an immutable queued payload or resend an unknown legacy outcome', async () => {
    const input = { userId: row.user_id, date: '2026-10-22', type: 'morning_brief', channel: 'email' as const, payload: row.payload };
    expect(await queueDigest(database({ duplicate: true }).db, input)).toBe(false);
    const legacy = database({ legacy: true });
    expect(await queueDigest(legacy.db, input)).toBe(false);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it('records acceptance separately and never reprocesses rows that were not claimed', async () => {
    claims([row]);
    const { db, update } = database();
    expect(await processDigestQueue(db)).toMatchObject({ sent: 1, failed: 0 });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'sent', provider_id: 'provider-id', lease_owner: null }));
    claims([]);
    await processDigestQueue(db); expect(mocks.send).toHaveBeenCalledTimes(1);
  });
  it('makes the third failure terminal and raises a sanitized operational alert', async () => {
    claims([{ ...row, attempts: 3 }], 1);
    mocks.send.mockResolvedValue({ ok: false, retryable: true, error: 'http_503' });
    const { db, update } = database();
    expect(await processDigestQueue(db)).toMatchObject({ failed: 1, retryable: 0 });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
    expect(JSON.stringify(mocks.alert.mock.calls)).not.toContain('test@example.test');
  });
  it('does not blindly replay a push after an ambiguous timeout', async () => {
    vi.stubEnv('VAPID_PUBLIC_KEY', 'test'); vi.stubEnv('VAPID_PRIVATE_KEY', 'test');
    mocks.push.mockRejectedValue(new Error('timeout'));
    const push: DigestDelivery = { ...row, channel: 'push', payload: { push: { title: 'test', body: 'test', url: 'https://example.test', tag: 'digest' } } };
    expect(await attemptDigest(push, database().db)).toMatchObject({ status: 'failed', error: 'push_outcome_unknown' });
  });
  it('removes only an expired push endpoint, and retries an explicit temporary rejection', async () => {
    vi.stubEnv('VAPID_PUBLIC_KEY', 'test'); vi.stubEnv('VAPID_PRIVATE_KEY', 'test');
    const push: DigestDelivery = { ...row, channel: 'push', payload: { push: { title: 'test', body: 'test', url: 'https://example.test', tag: 'digest' } } };
    mocks.push.mockRejectedValueOnce({ statusCode: 410 });
    expect(await attemptDigest(push, database().db)).toMatchObject({ status: 'failed', error: 'push_410' });
    expect(mocks.removeEndpoint).toHaveBeenCalledWith('subscription', { endpoint: 'https://example.test' });
    mocks.push.mockRejectedValueOnce({ statusCode: 503 });
    expect(await attemptDigest(push, database().db)).toMatchObject({ status: 'retryable', error: 'push_503' });
    expect(mocks.removeEndpoint).toHaveBeenCalledTimes(1);
  });
  it('fails the worker if final delivery state could not be saved', async () => {
    claims([row]);
    await expect(processDigestQueue(database({ finalError: true }).db)).rejects.toThrow('finalize');
  });
  it('reports SQL-terminalized expired or abandoned rows even without a newly claimed delivery', async () => {
    claims([], 4);
    expect(await processDigestQueue(database().db)).toMatchObject({ sent: 0, failed: 0, reportedFailures: 4 });
    expect(mocks.alert).toHaveBeenCalledWith(expect.objectContaining({ context: expect.objectContaining({ reportedFailures: 4 }) }));
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it('processes a full ten-message batch with spaced email starts within the worker budget', async () => {
    claims(Array.from({ length: 10 }, (_, i) => ({ ...row, id: `row-${i}` })));
    const startedAt: number[] = [];
    mocks.send.mockImplementation(async () => { startedAt.push(Date.now()); return { ok: true, id: 'provider-id' }; });
    const pending = processDigestQueue(database().db);
    await vi.advanceTimersByTimeAsync(6000);
    expect(await pending).toMatchObject({ sent: 10 });
    expect(mocks.rpc).toHaveBeenCalledWith('claim_digest_deliveries', expect.objectContaining({ p_limit: 10 }));
    expect(startedAt[9] - startedAt[0]).toBe(5400);
  });
  it('does not let a stalled recipient lookup run into the send phase after its timeout', async () => {
    const { db } = database();
    let release: (value: unknown) => void = () => {};
    vi.mocked(db.auth.admin.getUserById).mockImplementation(() => new Promise(resolve => { release = resolve as typeof release; }));
    claims([row]);
    const pending = processDigestQueue(db);
    await vi.advanceTimersByTimeAsync(5001);
    expect(await pending).toMatchObject({ retryable: 1 });
    release({ data: { user: { email: 'test@example.test' } } });
    await Promise.resolve();
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
