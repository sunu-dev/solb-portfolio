import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/apiRoute';
import { collectPolicyRelease } from '@/lib/marketCause/policyCollector';
export const maxDuration = 60;
export const GET = defineRoute({ name: '/api/cron/market-policy', auth: 'cron', rateLimit: false, handler: async ({ req }) => {
  const authority = req.nextUrl.searchParams.get('authority');
  if (authority !== 'fed' && authority !== 'bok') return NextResponse.json({ error: 'invalid_authority' }, { status: 400 });
  const result = await collectPolicyRelease(authority);
  const failed = result.status === 'revision_conflict' || result.status === 'stale_worker' || result.sourceStatus === 'source_unavailable' || result.sourceStatus === 'withheld';
  return NextResponse.json(result, { status: failed ? 503 : 200, headers: { 'Cache-Control': 'no-store' } });
} });
