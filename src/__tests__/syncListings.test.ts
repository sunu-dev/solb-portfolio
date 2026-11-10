import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

type Row = { symbol: string; exchange: string; status: string };
const state = vi.hoisted(() => ({ rows: [] as Row[], writes: [] as { op: string; rows: unknown }[], failWrite: false }));
vi.mock('@/lib/apiRoute', () => ({ defineRoute: ({ handler }: { handler: () => Promise<Response> }) => handler }));
vi.mock('@/lib/supabaseServer', () => ({ requireServiceClient: () => ({
  from: () => {
    let op = 'select';
    let value: unknown;
    let take = Infinity;
    const filters: ((row: Row) => boolean)[] = [];
    const query = {
      select: () => query,
      order: () => query,
      limit: (n: number) => { take = n; return query; },
      gt: (_: string, cursor: string) => { filters.push(row => row.symbol > cursor); return query; },
      in: (_: string, symbols: string[]) => { filters.push(row => symbols.includes(row.symbol)); return query; },
      neq: (_: string, status: string) => { filters.push(row => row.status !== status); return query; },
      insert: (rows: unknown) => { op = 'insert'; value = rows; return query; },
      update: (patch: unknown) => { op = 'update'; value = patch; return query; },
      then: (resolve: (result: unknown) => unknown) => {
        const rows = state.rows.filter(row => filters.every(filter => filter(row)))
          .sort((a, b) => a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0).slice(0, take);
        if (op !== 'select') state.writes.push({ op, rows: op === 'insert' ? value : { value, symbols: rows.map(row => row.symbol) } });
        return Promise.resolve(resolve({ data: op === 'select' ? rows : null, error: op !== 'select' && state.failWrite ? { message: 'test failure' } : null }));
      },
    };
    return query;
  },
}) }));
import { GET } from '@/app/api/cron/sync-listings/route';
const run = () => GET(new NextRequest('https://example.test/api/cron/sync-listings'));

let snapshots: Record<string, unknown>;
beforeEach(() => {
  state.rows = []; state.writes = []; state.failWrite = false;
  snapshots = { US: [], KS: [], KQ: [] };
  vi.stubEnv('FINNHUB_API_KEY', 'test-only');
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (!url.startsWith('https://finnhub.io/')) return Response.json({ ok: true });
    const value = snapshots[new URL(url).searchParams.get('exchange')!];
    return value instanceof Response ? value : Response.json(value);
  }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const symbol = (name: string) => ({ symbol: name, description: name, type: 'Common Stock' });

it('reads all 24,400 unchanged listings without writing any row', async () => {
  state.rows = Array.from({ length: 24400 }, (_, i) => ({ symbol: `S${String(i).padStart(5, '0')}`, exchange: 'US', status: 'watch' }));
  snapshots.US = state.rows.map(row => symbol(row.symbol));
  const response = await run();
  expect(response.status).toBe(200);
  expect((await response.json()).diagnostics).toMatchObject({ readBatches: 25, writeBatches: 0, unchangedCount: 24400 });
  expect(state.writes).toEqual([]);
});

it('preserves new listing detection, delisting, and universe protection', async () => {
  state.rows = [
    { symbol: 'KEEP', exchange: 'US', status: 'watch' },
    { symbol: 'GONE', exchange: 'US', status: 'watch' },
    { symbol: 'PROTECTED', exchange: 'US', status: 'universe' },
    { symbol: 'OLD', exchange: 'US', status: 'delisted' },
  ];
  snapshots.US = [symbol('KEEP'), symbol('NEW')];
  const result = await (await run()).json();
  expect(result.diff).toEqual({ newCount: 1, delistedCount: 2, universeDelisted: ['PROTECTED'] });
  expect(state.writes).toEqual([
    { op: 'insert', rows: [expect.objectContaining({ symbol: 'NEW', status: 'watch' })] },
    { op: 'update', rows: { value: { status: 'delisted' }, symbols: ['GONE'] } },
  ]);
});

it.each(['http-error', 'empty', 'malformed', 'unsupported'])('does not delist a market with an %s snapshot', async failure => {
  state.rows = [{ symbol: '005930', exchange: 'KS', status: 'watch' }];
  snapshots.US = [symbol('NEW')];
  snapshots.KS = failure === 'http-error' ? new Response('', { status: 503 })
    : failure === 'malformed' ? [{ description: 'missing symbol' }]
      : failure === 'unsupported' ? [{ ...symbol('005930'), type: 'UNKNOWN' }] : [];
  const result = await (await run()).json();
  expect(result.diff.delistedCount).toBe(0);
  expect(result.diagnostics.skippedExchanges).toContain('KS');
  expect(state.writes.every(write => write.op === 'insert')).toBe(true);
});

it('returns unavailable and makes no writes when all market snapshots fail', async () => {
  expect((await run()).status).toBe(503);
  expect(state.writes).toEqual([]);
});

it('reports failed persistence instead of announcing successful synchronization', async () => {
  snapshots.US = [symbol('NEW')]; state.failWrite = true;
  expect((await run()).status).toBe(500);
});
