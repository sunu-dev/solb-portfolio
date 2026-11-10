import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/apiRoute';
import { requireServiceClient } from '@/lib/supabaseServer';
import { runExplanationQuality } from '@/lib/marketCause/qualityCycle';
export const maxDuration = 30;
export const GET = defineRoute({ name: '/api/cron/market-cause-observe', auth: 'cron', rateLimit: false, handler: async () => {
  const { data, error } = await requireServiceClient().rpc('observe_market_cause_day');
  if (error || !data) throw new Error('observation_unavailable');
  const quality = await runExplanationQuality();
  return NextResponse.json({ ...data, quality }, { headers: { 'Cache-Control': 'no-store' } });
} });
