import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/apiRoute';
import { refreshMarketWatch } from '@/lib/marketWatchStore';
import { probeWatchSources } from '@/lib/marketWatchCollector';

export const maxDuration = 120;
export const GET = defineRoute({ name: '/api/cron/market-watch', auth: 'cron', rateLimit: false,
  handler: async ({ req }) => NextResponse.json(req.nextUrl.searchParams.get('diagnose') === '1'
    ? { probes: await probeWatchSources() } : await refreshMarketWatch('market')) });
