import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, string | null>;
const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rows: {} as Record<string, Row[]>,
  writes: [] as { table: string; ids: (string | null)[] }[],
  failRedaction: false,
}));
vi.mock('@/lib/supabaseServer', () => ({ requireServiceClient: () => ({ from: mocks.from }) }));
// Exercise the real cleanup handler; shared cron authentication is covered separately.
vi.mock('@/lib/apiRoute', () => ({ defineRoute: (options: { handler: unknown }) => options.handler }));
import { GET } from '@/app/api/cron/cleanup-pii/route';

function query(table: string) {
  let patch: Row | undefined;
  let deleting = false;
  const filters: ((row: Row) => boolean)[] = [];
  const chain = {
    update(value: Row) { patch = value; return chain; },
    delete() { deleting = true; return chain; },
    lt(field: string, value: string) { filters.push(row => row[field] != null && row[field]! < value); return chain; },
    not(field: string, _operation: string, value: null) { filters.push(row => row[field] !== value); return chain; },
    like(field: string, prefix: string) { filters.push(row => typeof row[field] === 'string' && row[field]!.startsWith(prefix.slice(0, -1))); return chain; },
    neq(field: string, value: string) { filters.push(row => row[field] !== value); return chain; },
    then(resolve: (value: { count: number; error: { message: string } | null }) => unknown) {
      if (mocks.failRedaction && patch?.user_key) return Promise.resolve(resolve({ count: 0, error: { message: 'temporary failure' } }));
      const rows = mocks.rows[table] ?? [];
      const selected = rows.filter(row => filters.every(filter => filter(row)));
      if (patch) {
        mocks.writes.push({ table, ids: selected.map(row => row.id) });
        for (const row of selected) Object.assign(row, patch);
      }
      if (deleting) mocks.rows[table] = rows.filter(row => !selected.includes(row));
      return Promise.resolve(resolve({ count: selected.length, error: null }));
    },
  };
  return chain;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-29T12:00:00.000Z'));
  mocks.failRedaction = false;
  mocks.writes = [];
  mocks.rows = { api_calls: [
    { id: 'old-anon', created_at: '2026-09-01T00:00:00.000Z', user_key: 'ip:192.0.2.10', ip: '192.0.2.10' },
    { id: 'old-null-ip', created_at: '2026-09-01T00:00:00.000Z', user_key: 'ip:2001:db8::1', ip: null },
    { id: 'old-member', created_at: '2026-09-01T00:00:00.000Z', user_key: 'member-fixture', ip: '192.0.2.11' },
    { id: 'recent-anon', created_at: '2026-10-29T11:00:00.000Z', user_key: 'ip:192.0.2.12', ip: '192.0.2.12' },
    { id: 'already-redacted', created_at: '2026-09-01T00:00:00.000Z', user_key: 'ip:removed', ip: null },
  ] };
  mocks.from.mockImplementation(query);
});
afterEach(() => vi.useRealTimers());

describe('PII cleanup: duplicate IP identifiers', () => {
  it('removes expired IPv4/IPv6 copies while preserving members and current rate-limit identifiers', async () => {
    const response = await GET(new NextRequest('http://localhost/api/cron/cleanup-pii'));
    const result = await response.json();
    expect(result).toMatchObject({ ok: true, api_calls_keys_redacted: 2 });
    const rows = mocks.rows.api_calls;
    expect(rows.find(row => row.id === 'old-anon')).toMatchObject({ user_key: 'ip:removed', ip: null });
    expect(rows.find(row => row.id === 'old-null-ip')).toMatchObject({ user_key: 'ip:removed', ip: null });
    expect(rows.find(row => row.id === 'old-member')).toMatchObject({ user_key: 'member-fixture', ip: null });
    expect(rows.find(row => row.id === 'recent-anon')).toMatchObject({ user_key: 'ip:192.0.2.12', ip: '192.0.2.12' });
    expect(mocks.writes.flatMap(write => write.ids)).not.toContain('already-redacted');
  });

  it('does not rewrite previously cleared rows on a second cleanup', async () => {
    await GET(new NextRequest('http://localhost/api/cron/cleanup-pii'));
    mocks.writes = [];
    const second = await (await GET(new NextRequest('http://localhost/api/cron/cleanup-pii'))).json();
    expect(second).toMatchObject({ ok: true, api_calls_anonymized: 0, api_calls_keys_redacted: 0 });
    expect(mocks.writes.flatMap(write => write.ids)).toEqual([]);
  });

  it('reports failed identifier removal instead of claiming success', async () => {
    mocks.failRedaction = true;
    const result = await (await GET(new NextRequest('http://localhost/api/cron/cleanup-pii'))).json();
    expect(result).toMatchObject({ ok: false, api_calls_keys_redacted: 0 });
    expect(result.errors).toContain('api_calls key redaction: temporary failure');
    expect(mocks.rows.api_calls.find(row => row.id === 'old-anon')?.user_key).toBe('ip:192.0.2.10');
  });
});
