import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/apiRoute';
import { refreshMarketWatch } from '@/lib/marketWatchStore';

export const maxDuration = 120;
export const GET = defineRoute({ name: '/api/cron/industry-watch', auth: 'cron', rateLimit: false,
  handler: async () => NextResponse.json(await refreshMarketWatch('industries')) });
