import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/apiRoute';
import { recoverMarketCause } from '@/lib/marketCause/recovery';
export const maxDuration = 300;
export const GET = defineRoute({ name: '/api/cron/market-cause-recovery', auth: 'cron', rateLimit: false, handler: async ({ req }) => {
  const group = req.nextUrl.searchParams.get('group');
  if (group !== null && !['chips', 'compute', 'platforms', 'consumer'].includes(group)) return NextResponse.json({ error: 'invalid_group' }, { status: 400 });
  const result = await recoverMarketCause(group);
  const failures = ['source_unavailable', 'analysis_failed', 'revision_conflict', 'stale_worker', 'attempts_exhausted'];
  const failed = result.results.some(r => failures.includes(r.status) || failures.includes(r.collectionStatus ?? ''));
  return NextResponse.json(result, { status: failed ? 503 : 200, headers: { 'Cache-Control': 'no-store' } });
} });
