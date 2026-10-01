import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/apiRoute';
import { getStockCatalog } from '@/lib/stockCatalog';

export const maxDuration = 30;
export const GET = defineRoute({
  name: '/api/cron/sync-search-catalog', auth: 'cron', rateLimit: false,
  handler: async () => {
    const catalog = await getStockCatalog();
    const degraded = catalog.sources.some(source => source.fallback);
    return NextResponse.json({ ok: !degraded, count: catalog.stocks.length, sources: catalog.sources }, { status: degraded ? 503 : 200 });
  },
});
