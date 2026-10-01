import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/apiRoute';
import { getEconomicFeed } from '@/lib/economicFeed';
export const maxDuration = 30;
export const GET = defineRoute({ name: '/api/cron/economic-events', auth: 'cron', rateLimit: false, handler: async () => {
  const feed = await getEconomicFeed();
  return NextResponse.json({ count: feed.events.length, confirmed: feed.events.filter(e=>e.result).length, checkedAt: feed.checkedAt, warnings: feed.warnings });
} });
