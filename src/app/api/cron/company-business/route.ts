import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/apiRoute';
import { runBusinessWorker } from '@/lib/companyBusiness/worker';
export const maxDuration = 240;
export const GET = defineRoute({ name: '/api/cron/company-business', auth: 'cron', rateLimit: false,
  handler: async () => {
    const result = await runBusinessWorker();
    return NextResponse.json(result, { status: result.status === 'held' ? 503 : 200, headers: { 'Cache-Control': 'no-store' } });
  },
});
